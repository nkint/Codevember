// ViewTrace.js

var GL = bongiovi.GL;
var gl;
var glslify = require("glslify");

function ViewTrace() {
	this.time = 0;
	var fs = glslify("../shaders/trace.frag");
	fs = fs.replace('{{NUM_ITER}}', Math.floor(params.numIter));
	fs = fs.replace('{{NUM_BALL}}', Math.floor(params.numBubble));
	bongiovi.View.call(this, glslify("../shaders/trace.vert"), fs);
}

var p = ViewTrace.prototype = new bongiovi.View();
p.constructor = ViewTrace;


p._init = function() {
	gl = GL.gl;
	var positions = [];
	var coords = [];
	var indices = []; 

	this.mesh = bongiovi.MeshUtils.createPlane(2, 2, 1);
};

p.render = function(texture, ry) {
	this.time +=.05;
	this.shader.bind();
	this.shader.uniform("resolution", "uniform2fv", [GL.width, GL.height]);
	this.shader.uniform("time", "uniform1f", this.time);
	this.shader.uniform("focus", "uniform1f", params.focus);
	this.shader.uniform("metaK", "uniform1f", params.metaK);
	this.shader.uniform("zGap", "uniform1f", params.zGap);
	this.shader.uniform("ry", "uniform1f", -ry+Math.PI/2);
	this.shader.uniform("maxDist", "uniform1f", params.maxDist);

	this.shader.uniform("texture", "uniform1i", 0);
	texture.bind(0);
	GL.draw(this.mesh);
};

module.exports = ViewTrace;