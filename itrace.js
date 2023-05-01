const fs = require("fs");

class OutputFileWriter {
  constructor(directory, session_id) {
    const filename = directory + "\\itrace_vscode-" + (new Date()).getTime().toString() + ".xml";
    console.log("iTrace: session started :: " + filename);
    this.file = fs.createWriteStream(filename);
    this.file.write("<?xml version=\"1.0\"?>\n");
    this.file.write("<itrace_plugin session_id=\"" + session_id + "\">\n");
    this.file.write("    <environment screen_width=\"" + window.screen.width.toString() + "\" screen_height=\"" + window.screen.height.toString() + "\" plugin_type=\"VSCODE\"/>\n");
    this.file.write("    <gazes>\n");
  }

  close_writer() {
    this.file.write("    </gazes>\n");
    this.file.write("</itrace_plugin>\n");
    this.file.end();
    console.log("iTrace: session finished");
  }

  write_gaze(event_id, x, y) {
    let editor = CodePosServer.getFileRowCol(x, y, true);
    this.file.write("        <response"
                    + " event_id=\"" + event_id + "\""
                    + " plugin_time=\"" + (new Date()).getTime().toString() + "\""
                    + " x=\"" + x + "\""
                    + " y=\"" + y + "\""
                    + " gaze_target=\"" + editor.openFile.split(/[\\/]/).at(-1) + "\""
                    + " gaze_target_type=\"" + editor.openFile.split(".").at(-1) + "\""
                    + " source_file_path=\"" + editor.openFile + "\""
                    + " source_file_line=\"" + editor.lineNum.toString() + "\""
                    + " source_file_col=\"" + editor.lineCol.toString() + "\""
                    + " editor_line_height=\"" + editor.lineHeight + "\""
                    + " editor_font_height=\"" + editor.fontSize + "\""
                    + " editor_line_base_x=\"" + editor.lineLeft + "\""
                    + " editor_line_base_y=\"" + editor.lineTop + "\""
                    + "/>\n"
                   );
  }
}

const noEditorOpen = {
  lineNum: -1,
  lineCol: -1,
  lineLeft: -1,
  lineTop: -1,
  lineHeight: -1,
  fontSize: -1,
  openFile: "",
};

class CodePosServer {
  static editorRegion = undefined;

  static getFileRowCol(x, y, scaleCoords) {
    if (CodePosServer.editorRegion === undefined) {
      CodePosServer.editorRegion = document.getElementById("workbench.parts.editor");
    }
    if (CodePosServer.editorRegion === null) {
      CodePosServer.editorRegion = undefined;
      return noEditorOpen;
    }

    const lineNumbers = Array.from(CodePosServer.editorRegion.querySelectorAll(".line-numbers"));
    if (!lineNumbers?.length) {
      return noEditorOpen;
    }

    if (scaleCoords) {
      x /= window.devicePixelRatio;
      y /= window.devicePixelRatio;
    }

    const editor = CodePosServer.editorRegion.querySelector(".lines-content");
    const editorBox = editor.getBoundingClientRect();
    const editorLeft = editorBox.left;

    let openFileTemp = CodePosServer.editorRegion
      .querySelector(".monaco-editor")
      .getAttribute("data-uri").replace("file:///", "").replace("%3A", ":");
    const openFile = openFileTemp[0].toUpperCase() + openFileTemp.slice(1);

    // things that mean we can skip row/col computation
    const noRowCol = CodePosServer.inWindow(".monaco-hover, "
                               + ".zone-widget, "
                               + ".lightBulbWidget, "
                               + ".codelens-decoration, "
                               + ".quick-input-widget, "
                               + ".suggest-widget, "
                               + ".suggest-details-container", x, y)
                     || openFile.length == 0
                     || !CodePosServer.inWindow(".part.editor", x, y);

    let lineNum = -1;
    let lineCol = 1;
    let lineLeft = -1;
    let lineTop = -1;
    let lineHeight = -1;
    let fontSize = -1;

    if (!noRowCol) {
      const lines = Array.from(document.querySelectorAll(".view-line"));
      if (lines?.length > 0) {
        let line = undefined;

        lines.filter((l) => {
          const rect = l.getBoundingClientRect();
          return y >= rect.top && y <= rect.bottom;
        }).forEach((l) => {
          const rowRect = l.firstChild.getBoundingClientRect();
          if (x >= rowRect.left && x <= rowRect.right) {
            line = l.firstChild;
            lineHeight = l.getBoundingClientRect().height;
            lineLeft = rowRect.left;
            lineTop = rowRect.top;
          }
        });

        if (line) {
          // get character info
          const charWidth = line.getBoundingClientRect().width / line.innerText.length;
          fontSize = parseFloat(window.getComputedStyle(line, null).fontSize);

          // get row
          let lineNumRectTop = undefined;
          let lastY = -1;
          lineNumbers
            .filter((l) => y >= l.getBoundingClientRect().top)
            .forEach((l) => {
              const num = parseInt(l.innerText);
              const rect = l.getBoundingClientRect();
              if (rect.top > lastY) {
                lineNum = num;
                lineNumRectTop = rect.top;
                lastY = rect.top;
              }
            });

          // get column
          let overGap = false;
          lines
            .filter((l) => {
              const rect = l.getBoundingClientRect();
              return rect.top <= y && rect.top >= lineNumRectTop;
            })
            .forEach((l) => {
              if (l.firstChild) {
                const lineRect = l.getBoundingClientRect();
                const rowRect = l.firstChild.getBoundingClientRect();
                if (l.firstChild.firstChild.classList.length == 0) {
                  const rect = l.firstChild.firstChild.getBoundingClientRect();
                  if (x >= rect.left && x <= rect.right && y >= lineRect.top && y <= lineRect.bottom) {
                    overGap = true;
                  }
                  if (y >= lineRect.top && y <= lineRect.bottom) {
                    lineCol += Math.floor((x - editorLeft - (rect.right - rect.left)) / charWidth);
                  } else {
                    lineCol += Math.floor((rowRect.right - editorLeft - (rect.right - rect.left)) / charWidth);
                  }
                } else {
                  if (y >= lineRect.top && y <= lineRect.bottom) {
                    lineCol += Math.floor((x - editorLeft) / charWidth);
                  } else {
                    lineCol += Math.floor((rowRect.right - editorLeft) / charWidth);
                  }
                }
              }
            });

          if (overGap || lineCol <= 1) {
            lineCol = -1;
          }
        }
      }
    }

    if (lineNum < 1 || lineCol < 1) {
      lineNum = -1;
      lineCol = -1;
      lineLeft = -1;
      lineTop = -1;
    }

    // these could be cached and only updated when a MutationObserver fires
    return {
      lineNum,
      lineCol,
      lineLeft,
      lineTop,
      lineHeight,
      fontSize,
      openFile,
    };
  }

  static inWindow(selector, x, y) {
    const objects = Array.from(document.querySelectorAll(selector));
    return objects?.some((o) => {
      const rect = o.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    });
  }

  coordsCallback(websocketEvent) {
    let data_arr = websocketEvent.data.trim().split(",");
    if (data_arr[0] == "session_end" || data_arr[0] == "session_stop") {
      this.writer.close_writer();
      this.writer = undefined;
    } else if (data_arr[0] == "session_start") {
      this.writer = new OutputFileWriter(data_arr[3], data_arr[1]);
    } else if (data_arr[0] == "gaze") {
      this.writer.write_gaze(data_arr[1], parseInt(data_arr[2]), parseInt(data_arr[3]));
    } else {
      console.log("Unsupported message: " + websocketEvent.data);
    }
  }

  constructor() {
    this.restart();
  }

  restart() {
    this.ws = new WebSocket("ws://127.0.0.1:7007");
    this.ws.addEventListener("message", (evt) => this.coordsCallback(evt));
    this.stop = () => {
      if (this.ws) {
        this.ws.close();
        this.ws = undefined;
      }
    };
    this.ws.addEventListener("error", (event) => {
      console.log("WebSocket error: ", event);
      this.writer?.close_writer();
      this.writer = undefined;
    });
    this.ws.addEventListener("close", (event) => {
      this.writer?.close_writer();
      this.writer = undefined;
    });
  }
}

function testCoords() {
  document.getElementsByTagName("body")[0].addEventListener("mousemove", (evnt) => {
    let editor = CodePosServer.getFileRowCol(evnt.x, evnt.y, false);
    console.log("<response"
                + " x=\"" + evnt.x + "\""
                + " y=\"" + evnt.y + "\""
                + " gaze_target=\"" + editor.openFile.split(/[\\/]/).at(-1) + "\""
                + " gaze_target_type=\"" + editor.openFile.split(".").at(-1) + "\""
                + " source_file_path=\"" + editor.openFile + "\""
                + " source_file_line=\"" + editor.lineNum.toString() + "\""
                + " source_file_col=\"" + editor.lineCol.toString() + "\""
                + " editor_line_height=\"" + editor.lineHeight + "\""
                + " editor_font_height=\"" + editor.fontSize + "\""
                + " editor_line_base_x=\"" + editor.lineLeft + "\""
                + " editor_line_base_y=\"" + editor.lineTop + "\""
                + "/>"
                );
  });
}

let scanner = new CodePosServer()
