const http = require("http");
const ws = new require("ws");
const wss = new ws.Server({noServer: true});
const robot = require("robotjs");

// how many mouse samples per second to send
const sampleRate = 60;
// how big a session is, in samples, before it auto-closes
const sessionSize = 1500;
// how long after a connect to start a session
const sessionDelay = 3000;

const clients = new Set();
const sessions = new Set();

if (process.argv.length == 2) {
  console.log('use: <pixelRatio> [<log_directory>]');
  return -1;
}

const pixelRatio = parseInt(process.argv[2]);

let log_directory;
if (process.argv.length > 3) {
  log_directory = process.argv[3];
} else {
  log_directory = "/Users/itrace/";
}
console.log("Storing XML logs in: " + log_directory);

log("Listening for connections...");
http.createServer((req, res) => {
  wss.handleUpgrade(req, req.socket, Buffer.alloc(0), onSocketConnect);
}).listen(7007);

function onSocketConnect(ws) {
  log("new client");
  clients.add(ws);
  setTimeout(startSession, 100);

  ws.on("message", function(message) {
    log("client message: " + message);
  });

  ws.on("close", function() {
    log("client closed");
    clients.delete(ws);
    sessions.delete(ws);
    if (sessions.size == 0) {
      endSession();
    }
  });
}

let sessionNum = 0;
function startSession() {
  sessionNum += 1;
  log("session::start " + sessionNum);
  clients.forEach((ws) => sessions.add(ws));

  setTimeout(delayedStart, sessionDelay);
}

function delayedStart() {
  sessions.forEach((ws) => ws.send("session_start," + sessionNum + ",," + log_directory));

  setTimeout(sendGaze, 1000 / sampleRate);
}

function endSession() {
  gazeCount = 0;
  sessions.forEach((ws) => ws.send("session_end"));
  sessions.clear();
  log("session::end");

  if (clients.size > 0) {
    setTimeout(startSession, 100);
  }
}

let gazeCount = 0;
function sendGaze() {
  if (sessions.size == 0) return;

  if (gazeCount >= sessionSize) {
    endSession();
    return;
  }

  gazeCount += 1;
  var mouse = robot.getMousePos();
  sessions.forEach((ws) => ws.send("gaze," + (gazeCount + 23985732 * sessionNum) + "," + (mouse.x * pixelRatio) + "," + (mouse.y * pixelRatio)));

  setTimeout(sendGaze, 1000 / sampleRate);
}

function log(msg) {
  console.log((new Date()).toString() + ": " + msg);
}
