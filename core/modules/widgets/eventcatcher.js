/*\
title: $:/core/modules/widgets/eventcatcher.js
type: application/javascript
module-type: widget

Event handler widget

\*/

"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var EventWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

/*
Inherit from the base widget class
*/
EventWidget.prototype = new Widget();

/*
Render this widget into the DOM
*/
EventWidget.prototype.render = function(parent,nextSibling) {
	var self = this;
	// Remember parent
	this.parentDomNode = parent;
	// Compute attributes and execute state
	this.computeAttributes();
	this.execute();
	// Create element
	var tag = this.parseTreeNode.isBlock ? "div" : "span";
	if(this.elementTag && $tw.config.htmlUnsafeElements.indexOf(this.elementTag) === -1) {
		tag = this.elementTag;
	}
	var domNode = this.document.createElement(tag);
	this.domNode = domNode;
	// Assign classes
	this.assignDomNodeClasses();
	// Add our event handlers
	this.toggleListeners();
	// Insert element
	parent.insertBefore(domNode,nextSibling);
	this.renderChildren(domNode,null);
	this.domNodes.push(domNode);
};

//TODO: call this from destroy
EventWidget.prototype.removeListeners = function() {
	// Release any pointer capture
	this._stopCapture(this._lastPointerId);
	// Helper: remove all listeners from a map
	const removeMapListeners = (map) => {
		Object.keys(map || {}).forEach((type) => {
			this.domNode.removeEventListener(type, map[type], false);
		});
	};
	// Remove static, dynamic starter, and active capture listeners
	removeMapListeners(this._eventListeners);
	if(this._dynamicPointerdownListener) {
		this.domNode.removeEventListener("pointerdown",this._dynamicPointerdownListener,false);
 	}
	removeMapListeners(this._captureActiveListeners);

	this._captureActiveListeners = Object.create(null);
};

EventWidget.prototype._startCapture = function(pointerId) {
	if(!this._lastPointerId && this.domNode && this.domNode.setPointerCapture) {
		this.domNode.setPointerCapture(pointerId);
		this._lastPointerId = pointerId;
	}
};

EventWidget.prototype._stopCapture = function(pointerId) {
	if(this.domNode && this.domNode.hasPointerCapture && this.domNode.hasPointerCapture(pointerId)) {
		this.domNode.releasePointerCapture(pointerId);
		this._lastPointerId = null;
		return true;
	}
	return false;
};

EventWidget.prototype._makeListener = function(type) {
	const self = this;
	return function(event) {
		let selector = self.getAttribute("selector"),
			matchSelector = self.getAttribute("matchSelector"),
			actions = self.getAttribute("$" + type) || self.getAttribute("actions-" + type),
			stopPropagation = self.getAttribute("stopPropagation", "onaction"),
			selectedNode = event.target,
			variables = {};

		// Normalize text nodes
		if(selectedNode.nodeType === 3) {
			selectedNode = selectedNode.parentNode;
		}
		// Match matchSelector first
		if(matchSelector && !$tw.utils.domMatchesSelector(selectedNode, matchSelector)) {
			return false;
		}
		// Match selector chain
		if(selector) {
			while(!$tw.utils.domMatchesSelector(selectedNode, selector) && selectedNode !== domNode) {
				selectedNode = selectedNode.parentNode;
			}
			if(selectedNode === domNode) {
				return false;
			}
			if(actions) {
				variables = $tw.utils.collectDOMVariables(selectedNode, self.domNode, event);
			}
		}
		// Execute actions if defined
		if(actions) {
			variables.modifier = $tw.keyboardManager.getEventModifierKeyDescriptor(event);
			const mouseButtonMap = {0: "left", 1: "middle", 2: "right"};
			variables["event-mousebutton"] = "button" in event ? mouseButtonMap[event.button] : undefined;
			variables["event-type"] = event.type.toString();
			if(typeof event.detail === "object" && !!event.detail) {
				$tw.utils.each(event.detail, (detailValue, detail) => {
					variables["event-detail-" + detail] = detailValue.toString();
				});
			} else if(!!event.detail) {
				variables["event-detail"] = event.detail.toString();
			}
			self.invokeActionString(actions, self, event, variables);
		}
		if((actions && stopPropagation === "onaction") || stopPropagation === "always") {
			event.preventDefault();
			event.stopPropagation();
			return true;
		}
		return false;
	};
};

EventWidget.prototype._cleanupDynamicListeners = function() {
	const domNode = this.domNode;
	Object.keys(this._captureActiveListeners).forEach(type => {
		domNode.removeEventListener(type, this._captureActiveListeners[type], false);
	});
	this._captureActiveListeners = Object.create(null);
};

EventWidget.prototype._makePointerCaptureStarter = function() {
	const self = this;
	return function(event) {
		self._startCapture(event);
		// Build active listeners for pointerup/cancel/move
		['pointerup', 'pointercancel'].forEach(type => {
			self._captureActiveListeners[type] = ev => {
				self._stopCapture(ev.pointerId);
				self._cleanupDynamicListeners();
				const listener = self._eventListeners[type];
				if(listener) {
					listener(ev);
				}
			};
		});
		if(self.types.includes("pointermove")) {
			self._captureActiveListeners.pointermove = self._eventListeners.pointermove;
		}
		// Attach active listeners
		Object.keys(self._captureActiveListeners).forEach(type => {
			self.domNode.addEventListener(type, self._captureActiveListeners[type], false);
		});
		// Run pointerdown actions
		if('pointerdown' in self._eventListeners) {
			self._eventListeners.pointerdown(event);
		}
	};
};


EventWidget.prototype.attachListeners = function() {
	const domNode = this.domNode,
		self = this,
		usePointerCapture = this.getAttribute("usePointerCapture", "yes") === "yes",
		dynamicPointerListeners = this.getAttribute("dynamicPointerListeners", "yes") === "yes";

	this._eventListeners = this._eventListeners || Object.create(null);
	this._captureActiveListeners = this._captureActiveListeners || Object.create(null);
	this._dynamicPointerdownListener = this._dynamicPointerdownListener || null;

	this.removeListeners();

	if(dynamicPointerListeners && usePointerCapture) {
		this.events.forEach(type => {
			if(!(type in self._eventListeners)) {
				self._eventListeners[type] = self._makeListener(type);
			}
		});
		if(!this._dynamicPointerdownListener) {
			this._dynamicPointerdownListener = this._makePointerCaptureStarter();
		}
		domNode.addEventListener("pointerdown", this._dynamicPointerdownListener, false);

		// Attach non-pointer events
		$tw.utils.each(this.types, type => {
			if(!type.startsWith("pointer")) {
				domNode.addEventListener(type, self._eventListeners[type], false);
			}
		});
	} else {
		// Attach all events, wrapping pointerevents if needed
		this.types.forEach( type => {
			if(!self._eventListeners[type]) {
				self._eventListeners[type] = event => {
					if(usePointerCapture) {
						if (type === "pointerdown") {
							self._startCapture(event);
						} else if(type === "pointerup" || type === "pointercancel") {
							self._makeListener(type)(event);
							self._stopCapture(event);
							return;
						}
					}
					self._makeListener(type)(event);
				};
			}
			domNode.addEventListener(type, self._eventListeners[type], false);
		});
	}
};


EventWidget.prototype.toggleListeners = function() {
	let disabled = this.getAttribute("disabled","no") === "yes";
	if(disabled) {
		this.removeListeners();
	} else {
		this.attachListeners();
	}		
}

/*
Compute the internal state of the widget
*/
EventWidget.prototype.execute = function() {
	var self = this;
	// Get attributes that require a refresh on change
	this.types = [];
	$tw.utils.each(this.attributes,function(value,key) {
		if(key.charAt(0) === "$") {
			self.types.push(key.slice(1));
		}
	});
	if(!this.types.length) {
		this.types = this.getAttribute("events","").split(" ");
	}
	this.elementTag = this.getAttribute("tag");
	// Make child widgets
	this.makeChildWidgets();
};

EventWidget.prototype.assignDomNodeClasses = function() {
	var classes = this.getAttribute("class","").split(" ");
	classes.push("tc-eventcatcher");
	this.domNode.className = classes.join(" ");
};

EventWidget.prototype.refresh = function(changedTiddlers) {
	let changedAttributes = this.computeAttributes(),
		changedKeys = Object.keys(changedAttributes);

	if(changedKeys.length === 0) {
		return this.refreshChildren(changedTiddlers);
	}
	// If only class or disabled attributes have changed, we can update the DOM node without a full refresh
	let canUpateAttributes = changedKeys.every(function(key) {
		return key === "class" || key === "disabled";
	});
	if(canUpateAttributes) {
		if(changedAttributes["class"]) {
			this.assignDomNodeClasses();
		}
		if(changedAttributes["disabled"]) {
			this.toggleListeners();
		}
		return false;
	}

	this.refreshSelf();
	return true;
};

exports.eventcatcher = EventWidget;
