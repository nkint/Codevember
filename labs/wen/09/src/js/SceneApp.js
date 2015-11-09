// SceneApp.js

var GL = bongiovi.GL, gl;
var ViewTrace = require("./ViewTrace");
var Bubble = require("./Bubble");
var random = function(min, max) { return min + Math.random() * (max - min);	}

function SceneApp() {
	this.count = 0;
	gl = GL.gl;
	bongiovi.Scene.call(this);
	this.resize();

	window.addEventListener("resize", this.resize.bind(this));
}


var p = SceneApp.prototype = new bongiovi.Scene();

p._initTextures = function() {
	console.log('Init Textures');
	this._texture = new bongiovi.GLTexture(images.light);
};

p._initViews = function() {
	console.log('Init Views');
	// this._vTrace = new ViewTrace();
	this.reset();
};


p.reset = function() {
	this._bubbles = [];
	var range = 1.25;

	for(var i=0; i<params.numBubble; i++) {
		var pos = [random(-range, range), random(-range, range), random(-range, range)];
		var size = random(2.55, 1.0);
		var b = new Bubble(pos, size);
		this._bubbles.push(b);
	}

	this._vTrace = new ViewTrace();	
};

p.render = function() {
	// this._vAxis.render();
	// this._vDotPlane.render();

	GL.clear(0, 0, 0, 0);

	GL.setMatrices(this.cameraOrtho);
	GL.rotate(this.rotationFront);

	this._vTrace.render(this._bubbles, this._texture);
};

p.resize = function() {
	var MAX = 600;
	var size = Math.min(window.innerWidth, window.innerHeight);
	size = Math.min(MAX, size);
	GL.setSize(size, size);
	GL.canvas.style.marginLeft = -size*.5 + "px";
	GL.canvas.style.marginTop = -size*.5 + "px";
	this.camera.resize(GL.aspectRatio);
};

module.exports = SceneApp;