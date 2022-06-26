import sys
import os
import pypco
import shelve
import requests
from datetime import datetime, timedelta
from flask import Flask, jsonify, render_template, request, send_from_directory, session, redirect
from requests_oauth2 import OAuth2BearerToken, OAuth2

TEST_MSG = 'hello world.'

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
except Exception as e:
    print(f"Must supply PCO_APP_ID, PCO_SECRET, PCO_OAUTH_CLIEND_ID, PCO_OAUTH_SECRET as environment vairables. - {e}")
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

print(f"PCO_APP_ID: {PCO_APP_ID}")

@app.route('/test')
def test():
    global TEST_MSG
    print(f"remote ip: {request.remote_addr}")
    return f"{TEST_MSG} {request.remote_addr}"

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
    s.auth = OAuth2BearerToken(data.get("access_token"))
    r = s.get("https://api.planningcenteronline.com/people/v2/me")
    r.raise_for_status()

    user = {}
    user['id'] = r['data']['id']
    user['name'] = r['data']['attributes']['name']
    user['first_name'] = r['data']['attributes']['first_name']
    user['avatar'] = r['data']['attributes']['avatar']
    user['passed_background_check'] = r['data']['attributes']['passed_background_check']
    user['self'] = r['data']['links']['self']
    app.users[data.get("access_token")] = user
    print(f"users: {app.users}")
    return redirect("/pco")

if __name__ == '__main__':
    app.run()