from cmd import IDENTCHARS
import sys
import os
import pypco
import shelve
import requests
from datetime import datetime, timedelta
from flask import Flask, jsonify, render_template, request, send_from_directory, session, redirect
from requests_oauth2 import OAuth2BearerToken, OAuth2
#from flask_socketio import SocketIO, emit, send
from azure.messaging.webpubsubservice import WebPubSubServiceClient

TEST_MSG = 'hello world.'
LIST_ID = '2287128'

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
except Exception as e:
    print(f"Must supply PCO_APP_ID, PCO_SECRET, PCO_OAUTH_CLIEND_ID, PCO_OAUTH_SECRET, PUBSUB_CONNECTION_STRING as environment vairables. - {e}")
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

pco = pypco.PCO(PCO_APP_ID, PCO_SECRET)
ws = WebPubSubServiceClient.from_connection_string(connection_string=PUBSUB_CONNECTION_STRING, hub='hub')

@app.route('/')
def index():
    if not session.get("access_token") or session.get("access_token") not in app.users:
        return redirect("/auth/callback")
    user = app.users[session.get("access_token")]
    return app.send_static_file('index.html')

@app.route('/auth/me')
def auth_me():
    if not session.get("access_token") or session.get("access_token") not in app.users:
        return redirect("/auth/callback")
    user = app.users[session.get("access_token")]
    return jsonify(user)

def getList(refresh=False):
    listResp = pco.get(f"/people/v2/lists/{LIST_ID}?include=people")
    if 'included' not in listResp:
        print(f"No data for list {listId} from PCO.")

    out = []
    for person in listResp['included']:
        outP = {}
        outP['id'] = person['id']
        outP['name'] = person['attributes']['name']
        outP['avatar'] = person['attributes']['avatar']
        out.append(outP)
    
    if refresh:
        app.list = out
        print("refreshing internal list")
    return out

@app.route('/list')
def list(refresh=False):
    if not session.get("access_token") or session.get("access_token") not in app.users:
        if not DEBUG:
            return redirect("/auth/callback")
    if request.args.get('refresh') is not None and request.args.get('refresh') == 'true':
        refresh = True
    return jsonify(getList(refresh))

@app.route('/checkin/<string:id>')
def checkin(id):
    if not session.get("access_token") or session.get("access_token") not in app.users:
        if not DEBUG:
            return redirect("/auth/callback")
    for i in app.list:
        if i['id'] == id:
            app.list.remove(i)
            print(f"checked in {id} and removed from app.list")
    #socketio.emit('checkin', {'id': id}, broadcast=True)
    ws.send_to_all(content_type="application/json", message={
        'checkin': id
    })
    return f"ok. {id}"

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



getList(refresh=True)
if __name__ == '__main__':
    app.run()
    #socketio.run(app, port=8000)
    