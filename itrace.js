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
    let pos = CodePosServer.getFileRowCol(x, y);
    this.file.write("        <response"
                    + " event_id=\"" + event_id + "\""
                    + " plugin_time=\"" + (new Date()).getTime().toString() + "\""
                    + " x=\"" + x + "\""
                    + " y=\"" + y + "\""
                    + " gaze_target=\"" + editor.openFile.split(/[\\/]/).at(-1) + "\""
                    + " gaze_target_type=\"" + editor.openFile.split(".").at(-1) + "\""
                    + " source_file_path=\"" + editor.openFile + "\""
                    + " source_file_line=\"" + editor.lineNum.toString() + "\""
                    + " source_file_col=\"" + editor.lienCol.toString() + "\""
                    + " editor_line_height=\"" + editor.lineHeight + "\""
                    + " editor_font_height=\"" + editor.fontSize + "\""
                    + " editor_line_base_x=\"" + editor.lineLeft + "\""
                    + " editor_line_base_y=\"" + editor.lineTop + "\""
                    + "/>\n"
                   );
  }
}

const noEditorOpen = {
  line: undefined,
  lineNum: -1,
  lineCol: -1,
  lineLeft: -1,
  lineTop: -1,
  charWidth: -1,
  lineHeight: -1,
  fontSize: -1,
  openFile: "",
};

class CodePosServer {
  static editorRegion = undefined;

  static getFileRowCol(x, y) {
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

    x /= window.devicePixelRatio;
    y /= window.devicePixelRatio;

    const editor = CodePosServer.editorRegion.querySelector(".lines-content");
    const editorBox = editor.getBoundingClientRect();
    const editorLeft = editorBox.left;

    let line = undefined;
    let lineHeight = -1;
    let lineLeft = -1;
    let lineTop = -1;
    const lines = Array.from(document.querySelectorAll(".view-line"));
    if (lines?.length > 0) {
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
    }

    let lineNum = -1;
    let lineNumRect = undefined;
    lineNumbers
      .filter((l) => y >= l.getBoundingClientRect().top)
      .forEach((l) => {
        const num = parseInt(l.innerText);
        if (num > lineNum) {
            lineNum = num;
            lineNumRect = l.getBoundingClientRect();
        }
      });

    let charWidth = -1;
    let fontSize = -1;
    if (line) {
      const lineBox = line.getBoundingClientRect();
      charWidth = lineBox.width / line.innerText.length;
      fontSize = parseFloat(window.getComputedStyle(line, null).fontSize);
    }

    let lineCol = 1;
    if (lineNumRect && lines?.length > 0) {
      const lineSpan = lines.filter((l) => {
        const rect = l.getBoundingClientRect();
        return rect.top <= y && rect.top >= lineNumRect.top;
      });
      let overGap = false;
      lineSpan.forEach((l) => {
          const rowRect = l.firstChild.getBoundingClientRect();
          let totalLength = 0;
          let lineLength = 0;
          if (l.firstChild.firstChild.classList.length == 0) {
            const rect = l.firstChild.firstChild.getBoundingClientRect();
            const lineRect = l.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= lineRect.top && y <= lineRect.bottom) {
                overGap = true;
            }
            lineLength = Math.floor((x - editorLeft - (rect.right - rect.left)) / charWidth);
            totalLength = Math.floor((rowRect.right - editorLeft - (rect.right - rect.left)) / charWidth);
          } else {
            lineLength  = Math.floor((x - editorLeft) / charWidth);
            totalLength = Math.floor((rowRect.right - editorLeft) / charWidth);
          }

          if (y >= rowRect.top && y <= rowRect.bottom) {
            lineCol += lineLength;
          } else {
            lineCol += totalLength;
          }
      });
      if (overGap || lineCol <= 1) {
        lineCol = -1;
      }
    }

    let openFileTemp = CodePosServer.editorRegion
      .querySelector(".monaco-editor")
      .getAttribute("data-uri").replace("file:///","").replace("%3A",":");
    const openFile = openFileTemp[0].toUpperCase() + openFileTemp.slice(1);

    if (CodePosServer.inWindow(
          ".monaco-hover, "
          + ".zone-widget, "
          + ".codelens-decoration, "
          + ".quick-input-widget, "
          + ".suggest-widget, "
          + ".suggest-details-container"
          , x, y)
        || openFile.length == 0
        || !CodePosServer.inWindow(".part.editor", x, y)
        || !line || lineNum < 1 || lineCol < 1) {
      lineNum = -1;
      lineCol = -1;
      lineLeft = -1;
      lineTop = -1;
    }

    // these could be cached and only updated when a MutationObserver fires
    return {
      editorLeft,
      line,
      lineNum,
      lineCol,
      lineLeft,
      lineTop,
      charWidth,
      lineHeight,
      fontSize,
      openFile,
    };
  }

  static inWindow(selector, x, y) {
    const objects = Array.from(document.querySelectorAll(selector));
    return objects?.some((o) => {
          const rect = o.getBoundingClientRect();
          return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
        });
  }

  coordsCallback(websocketEvent) {
    let data_arr = websocketEvent.data.trim().split(",");
    if (data_arr[0] == "session_end" || data_arr[0] == "session_stop") {
      this.writer.close_writer();
    } else if (data_arr[0] == "session_start") {
      this.writer = new OutputFileWriter(data_arr[3], data_arr[1]);
    } else if (data_arr[0] == "gaze") {
      this.writer.write_gaze(data_arr[1], parseInt(data_arr[2]), parseInt(data_arr[3]));
    } else {
      console.log("Unsupported message: " + websocketEvent.data);
    }
  }

  constructor() {
    this.ws = new WebSocket("ws://127.0.0.1:7007");
    this.ws.addEventListener("message", (evt) => this.coordsCallback(evt));
    this.stop = () => this.ws.close();
    this.ws.addEventListener("error", (event) => {
      console.log("WebSocket error: ", event);
      this.writer?.close_writer();
    });
    this.ws.addEventListener("close", (event) => {
      this.writer?.close_writer();
    });
  }
}

function testCoords() {
  document.getElementsByTagName("body")[0].addEventListener("mousemove", (evnt) => {
    let editor = CodePosServer.getFileRowCol(evnt.x, evnt.y);
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
