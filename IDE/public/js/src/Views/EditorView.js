var View = require('./View');
var Range = ace.require('ace/range').Range;

const uploadDelay = 50;

var uploadBlocked = false;
var currentFile;

class EditorView extends View {
	
	constructor(className, models){
		super(className, models);
		
		this.editor = ace.edit('editor');
		ace.require("ace/ext/language_tools");
		
		// set syntax mode
		this.editor.session.setMode('ace/mode/c_cpp');
		this.editor.$blockScrolling = Infinity;
		
		// set theme
		this.editor.setTheme("ace/theme/github");
		
		// autocomplete settings
		this.editor.setOptions({
			enableBasicAutocompletion: true,
			enableLiveAutocompletion: false,
			enableSnippets: true
		});
		
		// this function is called when the user modifies the editor
		this.editor.session.on('change', (e) => {
			//console.log('upload', !uploadBlocked);
			if (!uploadBlocked) this.editorChanged();
		});
		
		// set/clear breakpoints when the gutter is clicked
		this.editor.on("guttermousedown", (e) => { 
			var target = e.domEvent.target; 
			if (target.className.indexOf("ace_gutter-cell") == -1) 
				return; 
			if (!this.editor.isFocused()) 
				return; 
			if (e.clientX > 25 + target.getBoundingClientRect().left) 
				return; 

			var row = e.getDocumentPosition().row;

			this.emit('breakpoint', row);

			e.stop();

		});
		
		this.on('resize', () => this.editor.resize() );
		
	}
	
	editorChanged(){
		clearTimeout(this.uploadTimeout);
		this.uploadTimeout = setTimeout( () => this.emit('change', this.editor.getValue()), uploadDelay );
	}
	
	// model events
	// new file saved
	_fileData(data, opts){
	
		if (data instanceof ArrayBuffer){
			//console.log('arraybuffer');
			try{
				data = String.fromCharCode.apply(null, new Uint8Array(data));
			}
			catch(e){
				console.log(e);
				return;
			}
		}
		
		// block upload
		uploadBlocked = true;
		
		// put the file into the editor
		this.editor.session.setValue(data, -1);
		
		// unblock upload
		uploadBlocked = false;

		// force a syntax check
		this.emit('change');
	
		// focus the editor
		this._focus(opts.focus);
		
	}
	// editor focus has changed
	_focus(data){

		if (data && data.line !== undefined && data.column !== undefined)
			this.editor.gotoLine(data.line, data.column);
			
		this.editor.focus();
	}
	// syntax errors in current file have changed
	_currentFileErrors(errors){

		// clear any error annotations on the ace editor
		this.editor.session.clearAnnotations();

		if (errors.length >= 1){		
			// errors exist!
			// annotate the errors in this file
			this.editor.session.setAnnotations(errors);
						
		}
	}	
	// autocomplete settings have changed
	_liveAutocompletion(status){
		this.editor.setOptions({
			enableLiveAutocompletion: (parseInt(status) === 1)
		});
	}
	// readonly status has changed
	_readOnly(status){
		if (status){
			this.editor.setReadOnly(true);
		} else {
			this.editor.setReadOnly(false);
		}
	}
	// a new file has been opened
	_fileName(name, data){
		currentFile = name;
		this.__breakpoints(data.breakpoints, data);
	}
	// breakpoints have been changed
	__breakpoints(breakpoints, data){
		//console.log('setting breakpoints', breakpoints);
		this.editor.session.clearBreakpoints();
		for (let breakpoint of breakpoints){
			if (breakpoint.file === data.fileName){
				this.editor.session.setBreakpoint(breakpoint.line);
			}
		}
	}
	// debugger highlight line has changed
	__debugLine(line, data){
	console.log(line, data.debugFile, currentFile);
		this.removeDebuggerMarker();
		
		// add new marker at line
		if (line && data.debugFile === currentFile){
			this.editor.session.addMarker(new Range(line-1, 0, line-1, 1), "breakpointMarker", "fullLine");
			this.editor.gotoLine(line, 0);
		}
	}
	// debugger process has started or stopped
	_debugRunning(status){
		if (!status){
			this.removeDebuggerMarker();
		}
	}
	_debugBelaRunning(status){
		if (status){
			this.removeDebuggerMarker();
		}
	}
	
	removeDebuggerMarker(){
		var markers = this.editor.session.getMarkers();
		
		// remove existing marker
		Object.keys(markers).forEach( (key,index) => {
			if (markers[key].clazz === 'breakpointMarker'){
				this.editor.session.removeMarker(markers[key].id);
			}
		});
	}
}

module.exports = EditorView;