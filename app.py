import sys
import os
import pypco
import shelve
from datetime import datetime, timedelta
from flask import Flask, jsonify, render_template, request, send_from_directory

TEST_MSG = 'hello world.'

def logger(msg):
    time = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
    print(f"{time} - {msg}")


try:
    PCO_APP_ID = os.environ['PCO_APP_ID']
    PCO_SECRET = os.environ['PCO_SECRET'] # source ~/pco-env-vars.sh
except Exception as e:
    print(f"Must supply PCO_APP_ID, PCO_SECRET as environment vairables. - {e}")
    sys.exit(1)

app = Flask(__name__,
            static_url_path='', 
            static_folder='static',)

logger(f"PCO_APP_ID: {PCO_APP_ID}")

@app.route('/test')
def test():
    global TEST_MSG
    logger(f"remote ip: {request.remote_addr}")
    return f"{TEST_MSG} {request.remote_addr}"

if __name__ == '__main__':
    app.run()