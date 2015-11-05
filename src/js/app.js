var Model = require("./Model");
var bongiovi = require("./libs/bongiovi.min");

function App() {
	if(document.body) this._init();
	else {
		window.addEventListener("load", this._init.bind(this));
	}
}

var p = App.prototype;

p._init = function() {
	this.model = Model;
	this.iframe = document.body.querySelector('iframe');
	this.buttonTemplate = document.body.querySelector('.ExpButton');
	this.container = document.body.querySelector('.MainContainer');
	this.btnBack = document.body.querySelector('.Button-Back');
	this.btnBack.addEventListener('click', this._onBack.bind(this));
	this._onExpBind = this._onExp.bind(this);

	for(var i=0; i<this.model.length; i++) {
		var exp = this.model[i];
		var btn = this.buttonTemplate.cloneNode(true);
		btn.querySelector('img').src = exp.cover;
		btn.classList.remove('is-Hidden');
		this.container.appendChild(btn);
		btn.data = exp;
		btn.addEventListener('click', this._onExpBind);
	}
};

p._onExp = function(e) {
	this.iframe.src = e.target.data.path;
	
	document.body.classList.remove('show-exp');
	document.body.classList.add('show-exp');
};


p._onBack = function(e) {
	document.body.classList.remove('show-exp');
	bongiovi.Scheduler.delay(this, this.clearExp, null, 1000);
};


p.clearExp = function() {
	console.debug('Clear Iframe');
	this.iframe.src = '';
};


new App();