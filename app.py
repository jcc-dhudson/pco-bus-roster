from cmd import IDENTCHARS
import sys
import os
import pypco
import requests
from pytz import timezone
from datetime import datetime, timedelta
from flask import Flask, jsonify, render_template, request, send_from_directory, session, redirect
from requests_oauth2 import OAuth2BearerToken, OAuth2
from azure.messaging.webpubsubservice import WebPubSubServiceClient
from azure.cosmos import CosmosClient

LIST_ID = '2287128'
etc = timezone('America/New_York')
DATABASE_NAME = 'bus-roster'
CONTAINER_NAME = 'events'
DEMOUSER = {'name': 'TEST_NOT_AUTH', 'id': '1234', 'self': 'http://127.0.0.1:8000/self'}
curSession = datetime.now(timezone('UTC')).timestamp()
print(f"Current check-in session id: {curSession}")

DEBUG = False
if 'BUS_ROSTER_DEBUG' in os.environ:
    DEBUG = True
    print("WARNING! Running in insecure debug mode!")


# from: https://github.com/pastorhudson/PCO-oauth2
class PlanningCenterClient(OAuth2):
    site = "https://api.planningcenteronline.com"
    authorization_url = "/oauth/authorize"
    token_url = "/oauth/token"
    scope_sep = ' '

try:
    PCO_APP_ID = os.environ['PCO_APP_ID']
    PCO_SECRET = os.environ['PCO_SECRET'] # source ~/pco-env-vars.sh
    PCO_OAUTH_CLIEND_ID = os.environ['PCO_OAUTH_CLIEND_ID']
    PCO_OAUTH_SECRET = os.environ['PCO_OAUTH_SECRET']
    SELF_BASE_URL = os.environ['SELF_BASE_URL']
    SELF_SESSION_SECRET = os.environ['SELF_SESSION_SECRET']
    PUBSUB_CONNECTION_STRING = os.environ['PUBSUB_CONNECTION_STRING']
    COSMOS_URL = os.environ['COSMOS_URL']
    COSMOS_KEY = os.environ['COSMOS_KEY']
except Exception as e:
    print(f"Must supply PCO_APP_ID, PCO_SECRET, PCO_OAUTH_CLIEND_ID, COSMOS_KEY, COSMOS_URL, PCO_OAUTH_SECRET, PUBSUB_CONNECTION_STRING as environment vairables. - {e}")
    sys.exit(1)


pco_auth = PlanningCenterClient(
    client_id=PCO_OAUTH_CLIEND_ID,
    client_secret=PCO_OAUTH_SECRET,
    redirect_uri= SELF_BASE_URL + '/auth/callback'
)

app = Flask(__name__,
            static_url_path='', 
            static_folder='static',)
app.secret_key = SELF_SESSION_SECRET
app.users = {}
app.list = []
#socketio = SocketIO(app, async_mode='gevent')

cosmos = CosmosClient(COSMOS_URL, credential=COSMOS_KEY)
database = cosmos.get_database_client(DATABASE_NAME)
container = database.get_container_client(CONTAINER_NAME)
groupsContainer = database.get_container_client('groups')

pco = pypco.PCO(PCO_APP_ID, PCO_SECRET)
ws = WebPubSubServiceClient.from_connection_string(connection_string=PUBSUB_CONNECTION_STRING, hub='hub')

@app.route('/')
def index():
    if not session.get("access_token") or session.get("access_token") not in app.users:
        return redirect("/auth/callback")
    user = app.users[session.get("access_token")]
    return app.send_static_file('index.html')

@app.route('/write')
def writePage():
    if not session.get("access_token") or session.get("access_token") not in app.users:
        return redirect("/auth/callback")
    user = app.users[session.get("access_token")]
    return app.send_static_file('writetags.html')

@app.route('/eventview')
def eventPage():
    if not session.get("access_token") or session.get("access_token") not in app.users:
        return redirect("/auth/callback")
    user = app.users[session.get("access_token")]
    return app.send_static_file('events.html')

@app.route('/mygroup')
def mygroupPage():
    if not session.get("access_token") or session.get("access_token") not in app.users:
        return redirect("/auth/callback")
    user = app.users[session.get("access_token")]
    return app.send_static_file('mygroup.html')

@app.route('/writetag', methods = ['POST'])
def writeTag():
    if not session.get("access_token") or session.get("access_token") not in app.users:
        return redirect("/auth/callback")
    user = app.users[session.get("access_token")]
    data = request.json
    tagObj = {
        'channel': 'tags',
        'by_name': user['name'],
        'tagsCompleted': data['tagsCompleted']
    }
    ws.send_to_all(content_type="application/json", message=tagObj)
    return f"ok."

@app.route('/auth/me')
def auth_me():
    if not session.get("access_token") or session.get("access_token") not in app.users:
        return redirect("/auth/callback")
    user = app.users[session.get("access_token")]
    return jsonify(user)

def getList(refresh=False):
    listResp = pco.get(f"/people/v2/lists/{LIST_ID}?include=people")
    if 'included' not in listResp:
        print(f"No data for list {LIST_ID} from PCO.")

    out = []
    for person in listResp['included']:
        outP = {}
        outP['id'] = person['id']
        outP['name'] = person['attributes']['name']
        outP['avatar'] = person['attributes']['avatar']
        out.append(outP)

    return out

@app.route('/list')
def list(refresh=False):
    if not session.get("access_token") or session.get("access_token") not in app.users:
        if not DEBUG:
            return redirect("/auth/callback")
    user = app.users[session.get("access_token")]
    if request.args.get('refresh') is not None and request.args.get('refresh') == 'true':
        app.list = getList()
        ws.send_to_all(content_type="application/json", message={'refresh': True})
        curSession = datetime.now(timezone('UTC')).timestamp()

    if request.args.get('noStatus') is not None and request.args.get('noStatus') == 'true':
        return jsonify(getList())
    group_results = groupsContainer.query_items(f"SELECT * FROM groups g WHERE g.id = \"{user['id']}\"", enable_cross_partition_query=True)
    members = []
    outList = []
    for group in group_results:
        for member in group['members']:
            members.append(member)
    for pers in app.list:
        pers['sortby'] = pers['name']
        if pers['id'] in members:
            pers['sortby'] = '_' + pers['name']
        outList.append(pers)

    return jsonify(outList)
    

@app.route('/checkin', methods = ['POST'])
def checkin():
    now_utc = datetime.now(timezone('UTC'))
    checkinTime = now_utc.astimezone(etc)

    if not session.get("access_token") or session.get("access_token") not in app.users:
        user = DEMOUSER
        if not DEBUG:
            return redirect("/auth/callback")
    else:
        user = app.users[session.get("access_token")]

    data = request.json
    statusLine = f"{checkinTime.strftime('%H:%M:%S')} by {user['name']}"
    checkinObj = {
        'id': data['id'] + "_" + str(now_utc.timestamp()),
        'person_id': data['id'],
        'person_name': data['name'],
        'by_name': user['name'],
        'by_id': user['id'],
        'by_uri': user['self'],
        'location': data['location'],
        'status': statusLine,
        'datetime': now_utc.timestamp(),
        'session': str(curSession),
        'type': 'checkin'
    }

    ws.send_to_all(content_type="application/json", message=checkinObj)

    newList = []
    for i in app.list:
        if i['id'] == data['id']:
            i['status'] = statusLine
            i['location'] =  data['location']
            print(f"checked in {data['id']}")
        newList.append(i)
    app.list = newList
    
    container.upsert_item(checkinObj)
    return f"ok. {data['id']}"

@app.route('/events', methods = ['GET'])
def events_all(id=None):
    if not session.get("access_token") or session.get("access_token") not in app.users:
        return redirect("/auth/callback")
    events = []
    if request.args.get('session') is not None:
        qObj = {
            'query': f'SELECT * FROM {CONTAINER_NAME} e where e.session = @session',
            'parameters': [
                { 'name': '@session', 'value': request.args.get('session') }
            ]
        }
    else:
        qObj = { 'query': f'SELECT * FROM {CONTAINER_NAME} e' }
    for event in container.query_items(qObj, enable_cross_partition_query=True):
        events.append(event)
    return jsonify(events)

@app.route('/events/<id>', methods = ['GET', 'DELETE'])
def events_list(id=None):
    if not session.get("access_token") or session.get("access_token") not in app.users:
        if not DEBUG:
            return redirect("/auth/callback")
    if request.method == 'GET':
        events = []
        if request.args.get('session') is not None:
            qObj = {
                'query': f'SELECT * FROM {CONTAINER_NAME} e where e.session = @session',
                'parameters': [
                    { 'name': '@session', 'value': request.args.get('session') }
                ]
            }
        else:
            qObj = { 'query': f'SELECT * FROM {CONTAINER_NAME} e' }
        for event in container.query_items(qObj, enable_cross_partition_query=True):
            events.append(event)
        return jsonify(events)
    elif request.method == 'DELETE':
        if id is not None:
            qObj = {
                'query': f'SELECT * FROM {CONTAINER_NAME} e WHERE e.session = @session and e.person_id = @person_id',
                'parameters': [
                    { 'name': '@session', 'value': str(curSession) },
                    { 'name': '@person_id', 'value': id } 
                ]
            }
            print(f'SELECT * FROM {CONTAINER_NAME} e WHERE e.person_id = "{id}"')
            deletedCount = 0
            items = []
            for event in container.query_items(qObj, enable_cross_partition_query=True):
                for item in app.list:
                    if item['id'] == event['person_id']:
                        item.pop('status', None)
                        item['status'] = None
                        item['location'] = {}
                        item['person_id'] = item['id']
                        ws.send_to_all(content_type="application/json", message=item)
                    items.append(item)
                    
                response = container.delete_item(item=event['id'], partition_key=event['id'])
                deletedCount += 1
            if deletedCount > 0:
                app.list = items
                #ws.send_to_all(content_type="application/json", message={'refresh': True})
                
            return(f'deleted {deletedCount} items')
    return(f'must supply an id for deletes {id}', 500)

@app.route('/groups', methods = ['GET'])
def groupList():
    if not session.get("access_token") or session.get("access_token") not in app.users:
        return redirect("/auth/callback")
    user = app.users[session.get("access_token")]

    query_results = groupsContainer.query_items(f"SELECT * FROM groups g WHERE g.id = \"{user['id']}\"", enable_cross_partition_query=True)
    items = []
    for item in query_results:
        items = item['members']
    if(len(items) > 0):
        return jsonify({'members': items})
    else:
        return("not found for user", 404)

@app.route('/groups', methods = ['POST'])
def groupPost():
    if not session.get("access_token") or session.get("access_token") not in app.users:
        return redirect("/auth/callback")
    user = app.users[session.get("access_token")]
    data = request.json
    print(data['members'])
    membersObj = {
        'id': user['id'],
        'members': data['members']
    }
    query_results = groupsContainer.query_items(f"SELECT * FROM groups g WHERE g.id = \"{user['id']}\"", enable_cross_partition_query=True)
    items = []
    for item in query_results:
        groupsContainer.replace_item(item=item, body=membersObj)
    if(len(items) == 0):
        print(membersObj)
        groupsContainer.upsert_item(membersObj)
        
    return f"ok."
        

@app.route("/pco/")
def pco_index():
    user = {}
    print(f"users: {app.users}")
    if not session.get("access_token") or session.get("access_token") not in app.users:
        print(session)
        return redirect("/auth/callback")
        #s.auth = OAuth2BearerToken(session["access_token"])
    user = app.users[session.get("access_token")]
    return jsonify(user)

@app.route('/negotiate')
def negotiate():
    user = {}
    user['name'] = 'TEST_NOT_AUTH'
    if not session.get("access_token") or session.get("access_token") not in app.users:
        if not DEBUG:
            return redirect("/auth/callback")
    else:
        user = app.users[session.get("access_token")]
    

    token = ws.get_client_access_token(user_id=user['name'], minutes_to_expire=120)
    return {
        'url': token['url']
    }, 200


@app.route("/auth/callback")
def pco_oauth2callback():
    code = request.args.get("code")
    error = request.args.get("error")
    if error:
        return "error :( {!r}".format(error)
    if not code:
        return redirect(pco_auth.authorize_url(
            scope=["people", "registrations", "check_ins", "resources"],
            response_type="code",
        ))
    data = pco_auth.get_token(
        code=code,
        grant_type="authorization_code",
    )
    session["access_token"] = data.get("access_token")
    with requests.Session() as s:
        s.auth = OAuth2BearerToken(data.get("access_token"))
        r = s.get("https://api.planningcenteronline.com/people/v2/me")
    r.raise_for_status()
    
    d = r.json()
    authorized = False
    listResp = pco.get(f"/people/v2/lists/{LIST_ID}?include=people")
    for person in listResp['included']:
        if person['id'] == d['data']['id'] and person['attributes']['passed_background_check']:
            print(f"user {d['data']['attributes']['name']} is authorized.")
            authorized = True

    if authorized:
        user = {}
        user['id'] = d['data']['id']
        user['name'] = d['data']['attributes']['name']
        user['first_name'] = d['data']['attributes']['first_name']
        user['avatar'] = d['data']['attributes']['avatar']
        user['passed_background_check'] = d['data']['attributes']['passed_background_check']
        user['self'] = d['data']['links']['self']
        app.users[data.get("access_token")] = user
        print(f"users: {app.users}")
        return redirect("/")
    else:
        return "unauthorized", 403



app.list = getList(refresh=True)
if __name__ == '__main__':
    app.run()
    #socketio.run(app, port=8000)
    