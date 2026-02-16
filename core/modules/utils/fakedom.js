/*\
title: $:/core/modules/utils/fakedom.js
type: application/javascript
module-type: global

A barebones implementation of DOM interfaces needed by the rendering mechanism.
\*/

"use strict";

// Sequence number used to enable us to track objects for testing
let sequenceNumber = null;

const bumpSequenceNumber = obj => {
	if(sequenceNumber !== null) {
		obj.sequenceNumber = sequenceNumber++;
	}
};

// The Node prototype, never constructed
const TW_Node = function() {
	throw TypeError("Illegal constructor");
};

Object.defineProperty(TW_Node.prototype, 'ELEMENT_NODE', {
	get: () => 1
});

Object.defineProperty(TW_Node.prototype, 'TEXT_NODE', {
	get: () => 3
});

// TextNode constructor
const TW_TextNode = function(text) {
	bumpSequenceNumber(this);
	this.textContent = text + "";
	this.children = [];
};
Object.setPrototypeOf(TW_TextNode.prototype, TW_Node.prototype);

Object.defineProperty(TW_TextNode.prototype, "nodeType", {
	get: function() { return this.TEXT_NODE; }
});

Object.defineProperty(TW_TextNode.prototype, "formattedTextContent", {
	get: function() { return this.textContent.replace(/(\r?\n)/g,""); }
});

// Style helper
const TW_Style = el => {
	const style = el._style;

	const api = {
		get() { return style; },
		set(str) {
			if(!str) return;
			const parts = str.split(";");
			for(let i=0; i<parts.length; i++) {
				const decl = parts[i];
				if(!decl) continue;
				const p = decl.split(":");
				const name = $tw.utils.trim(p[0]);
				const value = $tw.utils.trim(p[1]);
				if(name && value) {
					style[$tw.utils.convertStyleNameToPropertyName(name)] = value;
				}
			}
		},
		setProperty(name,value) {
			style[name] = value;
		}
	};

	return new Proxy(api, {
		get(target, prop) {
			if(prop in target) return target[prop];
			return style[$tw.utils.convertStyleNameToPropertyName(prop)] || "";
		},
		set(target, prop, value) {
			style[$tw.utils.convertStyleNameToPropertyName(prop)] = value;
			return true;
		}
	});
};

// Element constructor
const TW_Element = function(tag, namespace) {
	bumpSequenceNumber(this);
	this.isTiddlyWikiFakeDom = true;
	this.tag = tag;
	this.attributes = {};
	this.isRaw = false;
	this.children = [];
	this._style = {};
	this.style = TW_Style(this);
	this.namespaceURI = namespace || "http://www.w3.org/1999/xhtml";
};
Object.setPrototypeOf(TW_Element.prototype, TW_Node.prototype);

// Node type
Object.defineProperty(TW_Element.prototype, "nodeType", {
	get: function() { return this.ELEMENT_NODE; }
});

// Attributes
TW_Element.prototype.getAttribute = function(name) {
	if(this.isRaw) throw "Cannot getAttribute on a raw TW_Element";
	return this.attributes[name];
};

TW_Element.prototype.setAttribute = function(name,value) {
	if(this.isRaw) throw "Cannot setAttribute on a raw TW_Element";
	if(name === "style") this.style.set(value);
	else this.attributes[name] = value + "";
};

TW_Element.prototype.setAttributeNS = function(ns,name,value) {
	this.setAttribute(name,value);
};

TW_Element.prototype.removeAttribute = function(name) {
	if(this.isRaw) throw "Cannot removeAttribute on a raw TW_Element";
	if($tw.utils.hop(this.attributes,name)) delete this.attributes[name];
};

// Children manipulation
TW_Element.prototype.appendChild = function(node) {
	this.children.push(node);
	node.parentNode = this;
};

TW_Element.prototype.insertBefore = function(node,nextSibling) {
	if(nextSibling) {
		const i = this.children.indexOf(nextSibling);
		if(i !== -1) {
			this.children.splice(i,0,node);
			node.parentNode = this;
			return;
		}
	}
	this.appendChild(node);
};

TW_Element.prototype.removeChild = function(node) {
	const i = this.children.indexOf(node);
	if(i !== -1) this.children.splice(i,1);
};

TW_Element.prototype.hasChildNodes = function() {
	return this.children.length > 0;
};

Object.defineProperty(TW_Element.prototype, "childNodes", {
	get: function() { return this.children; }
});

Object.defineProperty(TW_Element.prototype, "firstChild", {
	get: function() { return this.children[0]; }
});

// Event
TW_Element.prototype.addEventListener = function() {
	// noop
};

// Common properties
Object.defineProperty(TW_Element.prototype, "tagName", {
	get: function() { return this.tag || ""; }
});

Object.defineProperty(TW_Element.prototype, "className", {
	get: function() { return this.attributes["class"] || ""; },
	set: function(value) { this.attributes["class"] = value + ""; }
});

Object.defineProperty(TW_Element.prototype, "value", {
	get: function() { return this.attributes.value || ""; },
	set: function(value) { this.attributes.value = value + ""; }
});

// HTML serialization
Object.defineProperty(TW_Element.prototype, "outerHTML", {
	get: function() {
		const out = ["<", this.tag];
		const attrs = Object.keys(this.attributes).sort();
		for(const k of attrs) {
			const v = this.attributes[k];
			if(v !== undefined) out.push(" ", k, "=\"", $tw.utils.htmlEncode(v), "\"");
		}

		const styleKeys = Object.keys(this._style);
		if(styleKeys.length) {
			out.push(" style=\"");
			for(const s of styleKeys) {
				out.push($tw.utils.convertPropertyNameToStyleName(s), ":", this._style[s], ";");
			}
			out.push("\"");
		}

		out.push(">");
		if($tw.config.htmlVoidElements.indexOf(this.tag) === -1) {
			out.push(this.innerHTML, "</", this.tag, ">");
		}
		return out.join("");
	}
});

Object.defineProperty(TW_Element.prototype, "innerHTML", {
	get: function() {
		if(this.isRaw) return this.rawHTML;
		let out = [];
		for(const node of this.children) {
			if(node instanceof TW_Element) out.push(node.outerHTML);
			else out.push($tw.utils.htmlTextEncode(node.textContent));
		}
		return out.join("");
	},
	set: function(value) {
		this.isRaw = true;
		this.rawHTML = value;
		this.rawTextContent = null;
	}
});

Object.defineProperty(TW_Element.prototype, "textInnerHTML", {
	set: function(value) {
		if(!this.isRaw) throw "Cannot set textInnerHTML of a non-raw TW_Element";
		this.rawTextContent = value;
	}
});

Object.defineProperty(TW_Element.prototype, "textContent", {
	get: function() {
		if(this.isRaw) return this.rawTextContent === null ? "" : this.rawTextContent;
		return this.children.map(n => n.textContent).join("");
	},
	set: function(value) {
		this.children = [new TW_TextNode(value)];
	}
});

Object.defineProperty(TW_Element.prototype, "formattedTextContent", {
	get: function() {
		if(this.isRaw) return "";
		let out = "";
		const isBlock = $tw.config.htmlBlockElements.indexOf(this.tag) !== -1;
		if(isBlock) out += "\n";
		if(this.tag === "li") out += "* ";
		for(const node of this.children) out += node.formattedTextContent;
		if(isBlock) out += "\n";
		return out;
	}
});

// Fake document
const document = {
	setSequenceNumber(value) { sequenceNumber = value; },
	createElementNS(ns, tag) { return new TW_Element(tag, ns); },
	createElement(tag) { return new TW_Element(tag); },
	createTextNode(text) { return new TW_TextNode(text); },
	compatMode: "CSS1Compat",
	isTiddlyWikiFakeDom: true
};

exports.fakeDocument = document;
