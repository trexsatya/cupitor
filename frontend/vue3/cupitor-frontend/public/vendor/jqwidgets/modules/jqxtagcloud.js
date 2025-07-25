
/* Release Date: Jan-28-2025 
Copyright (c) 2011-2025 jQWidgets. 
License: https://jqwidgets.com/license/ */


/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 7196:
/***/ (() => {

/* tslint:disable */
/* eslint-disable */
(function(){
	if (typeof document === 'undefined') { 
		return;
	}

(function ($) {

    $.jqx.jqxWidget("jqxButtonGroup", "", {});

    $.extend($.jqx._jqxButtonGroup.prototype, {
        defineInstance: function () {
            var settings =
            {
                //Possible values: checkbox, radio, default
                mode: 'default',
                roundedCorners: true,
                disabled: false,
                enableHover: false,
                orientation: 'horizontal',
                width: null,
                height: null,
                _eventsMap: {
                    'mousedown': $.jqx.mobile.getTouchEventName('touchstart'),
                    'mouseup': $.jqx.mobile.getTouchEventName('touchend')
                },
                _events: ['selected', 'unselected', 'buttonclick'],
                _buttonId: {},
                _selected: null,
                _pressed: null,
                rtl: false,
                template: "",
                _baseId: 'group_button',
                aria:
                {
                    "aria-disabled": { name: "disabled", type: "boolean" }
                }
            };
            if (this === $.jqx._jqxButtonGroup.prototype) {
                return settings;
            }
            $.extend(true, this, settings);
            return settings;
        },

        createInstance: function (args) {
            var that = this;
            that._isTouchDevice = $.jqx.mobile.isTouchDevice();
            $.jqx.aria(that);
            that._baseId = that._baseId + that.element.id;
            that.addHandler(that.host, 'selectstart', function (event) {
                if (!that.disabled) {
                    event.preventDefault();
                }
            });
        },

        refresh: function () {
            var that = this;
            if (that.width) {
                if (that.width.toString() && that.width.toString().indexOf('%') >= 0) {
                    that.element.style.width = that.width;
                }
                else {
                    that.host.width(that.width);
                }
            }
            if (that.height) that.host.height(that.height);
            that._refreshButtons();
        },

        render: function () {
            this.refresh();
        },

        resize: function () {
            this.refresh();
        },

        _getEvent: function (event) {
            var that = this;
            if (that._isTouchDevice) {
                var e = that._eventsMap[event] || event;
                e += "." + that.element.id;
                return e;
            }
            event += "." + that.element.id;
            return event;
        },

        _refreshButtons: function () {
            var that = this;
            if (that.lastElement)
                that.lastElement.remove();

            that.lastElement = $("<div style='clear: both;'></div>");
            var children = that.host.children(),
                count = children.length,
                current;

            switch (that.mode) {
                case "radio":
                    that.host.attr('role', 'radiogroup');
                    break;
                case "checkbox":
                case "default":
                    that.host.attr('role', 'group');
                    break;
            }

            var width = new Number(100 / count).toFixed(2);
            for (var i = 0; i < count; i += 1) {
                current = $(children[i]);
                if (that.width) {
                    if (that.orientation === "horizontal") {
                        current.css('width', width + '%');
                        current.css('box-sizing', 'border-box');
                        current.css('-moz-box-sizing', 'border-box');
                        current.css('white-space', 'nowrap');
                        current.css('text-overflow', 'ellipsis');
                        current.css('overflow', 'hidden');
                    }
                    else {
                        current.css('box-sizing', 'border-box');
                        current.css('-moz-box-sizing', 'border-box');
                        current.css('width', '100%');
                    }
                }

                that._refreshButton(current, i, count);
            }
            that.lastElement.appendTo(that.host);
        },

        _refreshButton: function (btn, counter, count) {
            (function (btn) {
                var that = this;
                btn = that._render(btn);
                that._removeStyles(btn);
                that._addStyles(btn, counter, count);
                that._performLayout(btn);
                that._removeButtonListeners(btn);
                that._addButtonListeners(btn);
                that._handleButtonId(btn, counter);

                if (that.mode === "radio") {
                    btn.attr('role', 'radio');
                }
                else {
                    btn.attr('role', 'button');
                }
                btn.attr('disabled', that.disabled);
                if (that.disabled) {
                    btn.addClass(that.toThemeProperty('jqx-fill-state-disabled'));
                }
                else {
                    btn.removeClass(that.toThemeProperty('jqx-fill-state-disabled'));
                }
            }).apply(this, [btn]);
        },

        destroy: function (removeFromDom) {
            var that = this;
            var children = that.host.children(),
            count = children.length,
            current;

            for (var i = 0; i < count; i += 1) {
                current = $(children[i]);
                that._removeStyles(current);
                that._removeButtonListeners(current);
            }

            if (removeFromDom !== false) {
                that.host.remove();
            }
        },

        _render: function (btn) {
            var that = this;
            if (btn[0].tagName.toLowerCase() === 'button') {
                return that._renderFromButton(btn);
            } else {
                return that._renderButton(btn);
            }
        },

        _renderButton: function (btn) {
            var content;
            btn.wrapInner('<div/>');
            return btn;
        },

        _removeStyles: function (btn) {
            var that = this;
            var tp = that.toThemeProperty;
            that.host.removeClass('jqx-widget');
            that.host.removeClass('jqx-rc-all');
            btn.removeClass(tp.call(this, 'jqx-fill-state-normal'));
            btn.removeClass(tp.call(this, 'jqx-group-button-normal'));
            btn.removeClass(tp.call(this, 'jqx-rc-tl'));
            btn.removeClass(tp.call(this, 'jqx-rc-bl'));
            btn.removeClass(tp.call(this, 'jqx-rc-tr'));
            btn.removeClass(tp.call(this, 'jqx-rc-br'));
            btn.css('margin-left', 0);
        },

        _addStyles: function (btn, counter, count) {
            var that = this;
            var tp = this.toThemeProperty;
            that.host.addClass(tp.call(this, 'jqx-widget'));
            that.host.addClass(tp.call(this, 'jqx-rc-all'));
            that.host.addClass(tp.call(this, 'jqx-buttongroup'));
            btn.addClass(tp.call(this, 'jqx-button'));
            btn.addClass(tp.call(this, 'jqx-group-button-normal'));
            btn.addClass(tp.call(this, 'jqx-fill-state-normal'));
            if (that.template) {
                btn.addClass(tp.call(this, 'jqx-' + that.template));
            }
            if (that.roundedCorners) {
                if (counter === 0) {
                    that._addRoundedCorners(btn, true);
                } else if (counter === count - 1) {
                    that._addRoundedCorners(btn, false);
                }
            }
            if (that.orientation === 'horizontal') {
                btn.css('margin-left', -parseInt(btn.css('border-left-width'), 10));
            }
            else {
                btn.css('margin-top', -parseInt(btn.css('border-left-width'), 10));
            }
        },

        _addRoundedCorners: function (button, left) {
            var that = this;
            var tp = that.toThemeProperty;
            if (that.orientation === 'horizontal') {
                if (left) {
                    button.addClass(tp.call(this, 'jqx-rc-tl'));
                    button.addClass(tp.call(this, 'jqx-rc-bl'));
                } else {
                    button.addClass(tp.call(this, 'jqx-rc-tr'));
                    button.addClass(tp.call(this, 'jqx-rc-br'));
                }
            }
            else {
                if (left) {
                    button.addClass(tp.call(this, 'jqx-rc-tl'));
                    button.addClass(tp.call(this, 'jqx-rc-tr'));
                } else {
                    button.addClass(tp.call(this, 'jqx-rc-bl'));
                    button.addClass(tp.call(this, 'jqx-rc-br'));
                }
            }
        },

        _centerContent: function (content, parent) {
            content.css({
                'margin-top': (parent.height() - content.height()) / 2,
                'margin-left': (parent.width() - content.width()) / 2
            });
            return content;
        },

        _renderFromButton: function (btn) {
            var content = btn.val();
            if (content === "") {
                content = btn.html();
            }

            var div;
            var id = btn[0].id;
            btn.wrap('<div/>');
            div = btn.parent();
            div.attr('style', btn.attr('style'));
            btn.remove();
            $.jqx.utilities.html(div, content);
            div[0].id = id;
            return div;
        },

        _performLayout: function (btn) {
            if (this.orientation === 'horizontal') {
                if (this.rtl) {
                    btn.css('float', 'right');
                }
                else {
                    btn.css('float', 'left');
                }
            }
            else {
                btn.css('float', 'none');
            }

            this._centerContent($(btn.children()), btn);
        },

        _mouseEnterHandler: function (e) {
            var self = e.data.self,
                btn = $(e.currentTarget);
            if (self._isDisabled(btn) || !self.enableHover) {
                return;
            }
            var tp = self.toThemeProperty;
            btn.addClass(tp.call(self, 'jqx-group-button-hover'));
            btn.addClass(tp.call(self, 'jqx-fill-state-hover'));
        },

        _mouseLeaveHandler: function (e) {
            var self = e.data.self,
                btn = $(e.currentTarget);
            if (self._isDisabled(btn) || !self.enableHover) {
                return;
            }
            var tp = self.toThemeProperty;
            btn.removeClass(tp.call(self, 'jqx-group-button-hover'));
            btn.removeClass(tp.call(self, 'jqx-fill-state-hover'));
        },

        _mouseDownHandler: function (e) {
            var self = e.data.self,
                btn = $(e.currentTarget);
            if (self._isDisabled(btn)) {
                return;
            }
            self._pressed = btn;
            var tp = self.toThemeProperty;
            btn.addClass(tp.call(self, 'jqx-group-button-pressed'));
            btn.addClass(tp.call(self, 'jqx-fill-state-pressed'));
        },

        _mouseUpHandler: function (e) {
            var self = e.data.self,
                btn = $(e.currentTarget);
            if (self._isDisabled(btn)) {
                return;
            }
            self._handleSelection(btn);
            self._pressed = null;
            btn = self._buttonId[btn[0].id];
            self._raiseEvent(2, { index: btn.num, button: btn.btn });
        },

        _isDisabled: function (btn) {
            if (!btn || !btn[0]) {
                return false;
            }
            return this._buttonId[btn[0].id].disabled;
        },

        _documentUpHandler: function (e) {
            var self = e.data.self,
                pressedButton = self._pressed;
            if (pressedButton && !self._buttonId[pressedButton[0].id].selected) {
                pressedButton.removeClass(self.toThemeProperty('jqx-fill-state-pressed'));
                self._pressed = null;
            }
        },

        _addButtonListeners: function (btn) {
            var that = this;
            var ah = that.addHandler;
            var ge = that._getEvent;

            ah(btn, ge.call(that, 'mouseenter'), that._mouseEnterHandler, { self: that });
            ah(btn, ge.call(that, 'mouseleave'), that._mouseLeaveHandler, { self: that });
            ah(btn, ge.call(that, 'mousedown'), that._mouseDownHandler, { self: that });
            ah(btn, ge.call(that, 'mouseup'), that._mouseUpHandler, { self: that });
            ah($(document), ge.call(that, 'mouseup'), that._documentUpHandler, { self: that });
        },

        _removeButtonListeners: function (btn) {
            var that = this;
            var rh = that.removeHandler;
            var ge = that._getEvent;
            rh(btn, ge.call(that, 'mouseenter'), that._mouseEnterHandler);
            rh(btn, ge.call(that, 'mouseleave'), that._mouseLeaveHandler);
            rh(btn, ge.call(that, 'mousedown'), that._mouseDownHandler);
            rh(btn, ge.call(that, 'mouseup'), that._mouseUpHandler);
            rh($(document), ge.call(that, 'mouseup'), that._documentUpHandler);
        },

        _handleSelection: function (btn) {
            var that = this;
            if (that.mode === 'radio') {
                that._handleRadio(btn);
            } else if (that.mode === 'checkbox') {
                that._handleCheckbox(btn);
            } else {
                that._handleDefault(btn);
            }
        },

        _handleRadio: function (btn) {
            var that = this;
            var selected = that._getSelectedButton();
            if (selected && selected.btn[0].id !== btn[0].id) {
                that._unselectButton(selected.btn, true);
            }
            for (var data in that._buttonId) {
                that._buttonId[data].selected = true;
                that._unselectButton(that._buttonId[data].btn, false);
            }

            that._selectButton(btn, true);
        },

        _handleCheckbox: function (btn) {
            var that = this;
            var btnInfo = that._buttonId[btn[0].id];
            if (btnInfo.selected) {
                that._unselectButton(btnInfo.btn, true);
            } else {
                that._selectButton(btn, true);
            }
        },

        _handleDefault: function (btn) {
            var that = this;
            that._selectButton(btn, false);
            for (var data in that._buttonId) {
                that._buttonId[data].selected = true;
                that._unselectButton(that._buttonId[data].btn, false);
            }
        },

        _getSelectedButton: function () {
            var that = this;
            for (var data in that._buttonId) {
                if (that._buttonId[data].selected) {
                    return that._buttonId[data];
                }
            }
            return null;
        },

        _getSelectedButtons: function () {
            var that = this;
            var selected = [];
            for (var data in that._buttonId) {
                if (that._buttonId[data].selected) {
                    selected.push(that._buttonId[data].num);
                }
            }
            return selected;
        },

        _getButtonByIndex: function (index) {
            var that = this;
            var current;
            for (var data in that._buttonId) {
                if (that._buttonId[data].num === index) {
                    return that._buttonId[data];
                }
            }
            return null;
        },

        _selectButton: function (btn, raiseEvent) {
            var that = this;
            var btnInfo = that._buttonId[btn[0].id];
            if (btnInfo.selected) {
                return;
            }
            var tp = that.toThemeProperty;
            btnInfo.btn.addClass(tp.call(this, 'jqx-group-button-pressed'));
            btnInfo.btn.addClass(tp.call(this, 'jqx-fill-state-pressed'));
            btnInfo.selected = true;
            if (raiseEvent) {
                that._raiseEvent(0, { index: btnInfo.num, button: btnInfo.btn });
            }
            $.jqx.aria(btnInfo.btn, 'aria-checked', true);
        },

        _unselectButton: function (btn, raiseEvent) {
            var that = this;
            var btnInfo = that._buttonId[btn[0].id];
            if (!btnInfo.selected) {
                return;
            }
            var tp = that.toThemeProperty;
            btnInfo.btn.removeClass(tp.call(this, 'jqx-group-button-pressed'));
            btnInfo.btn.removeClass(tp.call(this, 'jqx-fill-state-pressed'));
            btnInfo.selected = false;
            if (raiseEvent) {
                that._raiseEvent(1, { index: btnInfo.num, button: btnInfo.btn });
            }
            $.jqx.aria(btnInfo.btn, 'aria-checked', false);
        },

        setSelection: function (index) {
            var that = this;
            if (index === -1) {
                that.clearSelection();
                return;
            }

            if (that.mode === 'checkbox') {
                if (typeof index === 'number') {
                    that._setSelection(index);
                } else {
                    for (var i = 0; i < index.length; i += 1) {
                        that._setSelection(index[i]);
                    }
                }
            } else if (typeof index === 'number' && that.mode === 'radio') {
                that._setSelection(index);
            }
        },

        _setSelection: function (index) {
            var that = this;
            var btn = that._getButtonByIndex(index);
            if (btn) {
                that._handleSelection(btn.btn);
            }
        },

        getSelection: function () {
            var that = this;
            if (that.mode === 'radio') {
                if (that._getSelectedButton()) {
                    return that._getSelectedButton().num;
                }
            } else if (that.mode === 'checkbox') {
                return that._getSelectedButtons();
            }
            return undefined;
        },

        disable: function () {
            var that = this;
            that.disabled = true;
            var current;
            for (var btn in that._buttonId) {
                current = that._buttonId[btn];
                that.disableAt(current.num);
            }
            $.jqx.aria(that, "aria-disabled", true);
        },

        enable: function () {
            var that = this;
            that.disabled = false;
            var current;
            for (var btn in that._buttonId) {
                current = that._buttonId[btn];
                that.enableAt(current.num);
            }
            $.jqx.aria(that, "aria-disabled", false);
        },

        disableAt: function (index) {
            var that = this;
            var btn = that._getButtonByIndex(index);
            if (!btn.disabled) {
                btn.disabled = true;
                btn.btn.addClass(that.toThemeProperty('jqx-fill-state-disabled'));
            }
        },

        enableAt: function (index) {
            var that = this;
            var btn = that._getButtonByIndex(index);
            if (btn.disabled) {
                btn.disabled = false;
                btn.btn.removeClass(that.toThemeProperty('jqx-fill-state-disabled'));
            }
        },

        _handleButtonId: function (btn, number) {
            var id = btn[0].id,
                btnId = { btn: btn, num: number, selected: false },
                widgetId;
            if (!id) {
                id = this._baseId + btn.index();
            }
            btn[0].id = id;
            this._buttonId[id] = btnId;
            return id;
        },

        _raiseEvent: function (id, data) {
            var event = $.Event(this._events[id]);
            event.args = data;
            return this.host.trigger(event);
        },

        _unselectAll: function () {
            for (var data in this._buttonId) {
                this._unselectButton(this._buttonId[data].btn, false);
            }
        },

        clearSelection: function () {
            this._unselectAll();
        },

        propertyChangedHandler: function (object, key, oldvalue, value) {
            if (key === 'theme' && value !== null) {
                $.jqx.utilities.setTheme(oldvalue, value, object.host);
            }

            if (key === 'rtl') {
                object.refresh();
            }
            if (key === "template") {
                object.refresh();
            }
            if (key === 'mode') {
                object._unselectAll();
                object.refresh();
                return;
            } else if (key === 'disabled') {
                if (value) {
                    object.disable();
                } else {
                    object.enable();
                }
            } else {
                object.refresh();
            }
        }
    });
})(jqxBaseFramework);
})();



/***/ }),

/***/ 7351:
/***/ (() => {

/* tslint:disable */
/* eslint-disable */
(function () {
    if (typeof document === 'undefined') {
        return;
    }

    (function ($) {
        $.jqx.cssroundedcorners = function (value) {
            var cssMap = {
                'all': 'jqx-rc-all',
                'top': 'jqx-rc-t',
                'bottom': 'jqx-rc-b',
                'left': 'jqx-rc-l',
                'right': 'jqx-rc-r',
                'top-right': 'jqx-rc-tr',
                'top-left': 'jqx-rc-tl',
                'bottom-right': 'jqx-rc-br',
                'bottom-left': 'jqx-rc-bl'
            };

            for (var prop in cssMap) {
                if (!cssMap.hasOwnProperty(prop))
                    continue;

                if (value == prop)
                    return cssMap[prop];
            }
        }

        $.jqx.jqxWidget("jqxButton", "", {});

        $.extend($.jqx._jqxButton.prototype, {
            defineInstance: function () {
                var settings = {
                    type: '',
                    cursor: 'arrow',
                    // rounds the button corners.
                    roundedCorners: 'all',
                    // enables / disables the button
                    disabled: false,
                    // sets height to the button.
                    height: null,
                    // sets width to the button.
                    width: null,
                    overrideTheme: false,
                    enableHover: true,
                    enableDefault: true,
                    enablePressed: true,
                    imgPosition: "center",
                    imgSrc: "",
                    imgWidth: 16,
                    imgHeight: 16,
                    value: null,
                    textPosition: "",
                    textImageRelation: "overlay",
                    rtl: false,
                    _ariaDisabled: false,
                    _scrollAreaButton: false,
                    // "primary", "inverse", "danger", "info", "success", "warning", "link"
                    template: "default",
                    aria:
                    {
                        "aria-disabled": { name: "disabled", type: "boolean" }
                    }
                }
                if (this === $.jqx._jqxButton.prototype) {
                    return settings;
                }
                $.extend(true, this, settings);
                return settings;
            },

            _addImage: function (name) {
                var that = this;
                if (that.element.nodeName.toLowerCase() == "input" || that.element.nodeName.toLowerCase() == "button" || that.element.nodeName.toLowerCase() == "div") {
                    if (!that._img) {
                        that.field = that.element;
                        if (that.field.className) {
                            that._className = that.field.className;
                        }

                        var properties = {
                            'title': that.field.title
                        };

                        var value = null;
                        if (that.field.getAttribute('value')) {
                            var value = that.field.getAttribute('value');
                        }
                        else if (that.element.nodeName.toLowerCase() != "input") {
                            var value = that.element.innerHTML;
                        }
                        if (that.value) {
                            value = that.value;
                        }
                        if (that.field.id.length) {
                            properties.id = that.field.id.replace(/[^\w]/g, '_') + "_" + name;
                        }
                        else {
                            properties.id = $.jqx.utilities.createId() + "_" + name;
                        }


                        var wrapper = document.createElement('div');
                        wrapper.id = properties.id;
                        wrapper.title = properties.title;
                        wrapper.style.cssText = that.field.style.cssText;
                        wrapper.style.boxSizing = 'border-box';

                        var img = document.createElement("img");
                        img.setAttribute('src', that.imgSrc);
                        img.setAttribute('width', that.imgWidth);
                        img.setAttribute('height', that.imgHeight);
                        wrapper.appendChild(img);
                        that._img = img;

                        var text = document.createElement('span');
                        if (value) {
                            text.innerHTML = value;
                            that.value = value;
                        }
                        wrapper.appendChild(text);
                        that._text = text;

                        that.field.style.display = "none";
                        if (that.field.parentNode) {
                            that.field.parentNode.insertBefore(wrapper, that.field.nextSibling);
                        }

                        var data = that.host.data();
                        that.host = $(wrapper);
                        that.host.data(data);
                        that.element = wrapper;
                        that.element.id = that.field.id;
                        that.field.id = properties.id;
                        var elementObj = new $(that.element);
                        var fieldObj = new $(that.field);
                        if (that._className) {
                            elementObj.addClass(that._className);
                            fieldObj.removeClass(that._className);
                        }

                        if (that.field.tabIndex) {
                            var tabIndex = that.field.tabIndex;
                            that.field.tabIndex = -1;
                            that.element.tabIndex = tabIndex;
                        }
                    }
                    else {
                        that._img.setAttribute('src', that.imgSrc);
                        that._img.setAttribute('width', that.imgWidth);
                        that._img.setAttribute('height', that.imgHeight);
                        that._text.innerHTML = that.value;
                    }
                    if (!that.imgSrc) {
                        that._img.style.display = "none";
                    }
                    else {
                        that._img.style.display = "inline";
                    }

                    if (!that.value) {
                        that._text.style.display = "none";
                    }
                    else {
                        that._text.style.display = "inline";
                    }

                    that._positionTextAndImage();
                }
            },

            _positionTextAndImage: function () {
                var that = this;
                var width = that.element.offsetWidth;
                var height = that.element.offsetHeight;

                var imgWidth = that.imgWidth;
                var imgHeight = that.imgHeight;
                if (that.imgSrc == "") {
                    imgWidth = 0;
                    imgHeight = 0;
                }

                var textWidth = that._text.offsetWidth;
                var textHeight = that._text.offsetHeight;
                var offset = 4;
                var edgeOffset = 4;
                var factorIncrease = 4;
                var w = 0;
                var h = 0;
                switch (that.textImageRelation) {
                    case "imageBeforeText":
                    case "textBeforeImage":
                        w = imgWidth + textWidth + 2 * factorIncrease + offset + 2 * edgeOffset;
                        h = Math.max(imgHeight, textHeight) + 2 * factorIncrease + offset + 2 * edgeOffset;
                        break;
                    case "imageAboveText":
                    case "textAboveImage":
                        w = Math.max(imgWidth, textWidth) + 2 * factorIncrease;
                        h = imgHeight + textHeight + offset + 2 * factorIncrease + 2 * edgeOffset;
                        break;
                    case "overlay":
                        w = Math.max(imgWidth, textWidth) + 2 * factorIncrease;
                        h = Math.max(imgHeight, textHeight) + 2 * factorIncrease;
                        break;
                }

                if (!that.width) {
                    that.element.style.width = w + "px";
                    width = w;
                }

                if (!that.height) {
                    that.element.style.height = h + "px";
                    height = h;
                }

                that._img.style.position = 'absolute';
                that._text.style.position = 'absolute';
                that.element.style.position = 'relative';
                that.element.style.overflow = 'hidden';

                var textRect = {};
                var imageRect = {};

                var drawElement = function (element, drawArea, pos, w, h) {
                    if (drawArea.width < w) drawArea.width = w;
                    if (drawArea.height < h) drawArea.height = h;

                    switch (pos) {
                        case "left":
                            element.style.left = drawArea.left + "px";
                            element.style.top = drawArea.top + drawArea.height / 2 - h / 2 + "px";;
                            break;
                        case "topLeft":
                            element.style.left = drawArea.left + "px";
                            element.style.top = drawArea.top + "px";
                            break;
                        case "bottomLeft":
                            element.style.left = drawArea.left + "px";
                            element.style.top = drawArea.top + drawArea.height - h + "px";
                            break;
                        default:
                        case "center":
                            element.style.left = drawArea.left + drawArea.width / 2 - w / 2 + "px";
                            element.style.top = drawArea.top + drawArea.height / 2 - h / 2 + "px";
                            break;
                        case "top":
                            element.style.left = drawArea.left + drawArea.width / 2 - w / 2 + "px";
                            element.style.top = drawArea.top + "px";
                            break;
                        case "bottom":
                            element.style.left = drawArea.left + drawArea.width / 2 - w / 2 + "px";
                            element.style.top = drawArea.top + drawArea.height - h + "px";
                            break;
                        case "right":
                            element.style.left = drawArea.left + drawArea.width - w + "px";
                            element.style.top = drawArea.top + drawArea.height / 2 - h / 2 + "px";;
                            break;
                        case "topRight":
                            element.style.left = drawArea.left + drawArea.width - w + "px";
                            element.style.top = drawArea.top + "px";
                            break;
                        case "bottomRight":
                            element.style.left = drawArea.left + drawArea.width - w + "px";
                            element.style.top = drawArea.top + drawArea.height - h + "px";
                            break;
                    }
                }

                var left = 0;
                var top = 0;
                var right = width;
                var bottom = height;
                var middle = (right - left) / 2;
                var center = (bottom - top) / 2;
                var img = that._img;
                var text = that._text;
                var rectHeight = bottom - top;
                var rectWidth = right - left;
                left += edgeOffset;
                top += edgeOffset;
                right = right - edgeOffset - 2;
                rectWidth = rectWidth - 2 * edgeOffset - 2;
                rectHeight = rectHeight - 2 * edgeOffset - 2;

                switch (that.textImageRelation) {
                    case "imageBeforeText":

                        switch (that.imgPosition) {
                            case "left":
                            case "topLeft":
                            case "bottomLeft":
                                imageRect = { left: left, top: top, width: left + imgWidth, height: rectHeight };
                                textRect = { left: left + imgWidth + offset, top: top, width: rectWidth - imgWidth - offset, height: rectHeight };
                                break;
                            case "center":
                            case "top":
                            case "bottom":
                                imageRect = { left: middle - textWidth / 2 - imgWidth / 2 - offset / 2, top: top, width: imgWidth, height: rectHeight };
                                textRect = { left: imageRect.left + imgWidth + offset, top: top, width: right - imageRect.left - imgWidth - offset, height: rectHeight };
                                break;
                            case "right":
                            case "topRight":
                            case "bottomRight":
                                imageRect = { left: right - textWidth - imgWidth - offset, top: top, width: imgWidth, height: rectHeight };
                                textRect = { left: imageRect.left + imgWidth + offset, top: top, width: right - imageRect.left - imgWidth - offset, height: rectHeight };
                                break;

                        }
                        drawElement(img, imageRect, that.imgPosition, imgWidth, imgHeight);
                        drawElement(text, textRect, that.textPosition, textWidth, textHeight);

                        break;
                    case "textBeforeImage":

                        switch (that.textPosition) {
                            case "left":
                            case "topLeft":
                            case "bottomLeft":
                                textRect = { left: left, top: top, width: left + textWidth, height: rectHeight };
                                imageRect = { left: left + textWidth + offset, top: top, width: rectWidth - textWidth - offset, height: rectHeight };
                                break;
                            case "center":
                            case "top":
                            case "bottom":
                                textRect = { left: middle - textWidth / 2 - imgWidth / 2 - offset / 2, top: top, width: textWidth, height: rectHeight };
                                imageRect = { left: textRect.left + textWidth + offset, top: top, width: right - textRect.left - textWidth - offset, height: rectHeight };
                                break;
                            case "right":
                            case "topRight":
                            case "bottomRight":
                                textRect = { left: right - textWidth - imgWidth - offset, top: top, width: textWidth, height: rectHeight };
                                imageRect = { left: textRect.left + textWidth + offset, top: top, width: right - textRect.left - textWidth - offset, height: rectHeight };
                                break;

                        }
                        drawElement(img, imageRect, that.imgPosition, imgWidth, imgHeight);
                        drawElement(text, textRect, that.textPosition, textWidth, textHeight);

                        break;
                    case "imageAboveText":

                        switch (that.imgPosition) {
                            case "topRight":
                            case "top":
                            case "topLeft":
                                imageRect = { left: left, top: top, width: rectWidth, height: imgHeight };
                                textRect = { left: left, top: top + imgHeight + offset, width: rectWidth, height: rectHeight - imgHeight - offset };
                                break;
                            case "left":
                            case "center":
                            case "right":
                                imageRect = { left: left, top: center - imgHeight / 2 - textHeight / 2 - offset / 2, width: rectWidth, height: imgHeight };
                                textRect = { left: left, top: imageRect.top + offset + imgHeight, width: rectWidth, height: rectHeight - imageRect.top - offset - imgHeight };
                                break;
                            case "bottomLeft":
                            case "bottom":
                            case "bottomRight":
                                imageRect = { left: left, top: bottom - imgHeight - textHeight - offset, width: rectWidth, height: imgHeight };
                                textRect = { left: left, top: imageRect.top + offset + imgHeight, width: rectWidth, height: textHeight };
                                break;

                        }
                        drawElement(img, imageRect, that.imgPosition, imgWidth, imgHeight);
                        drawElement(text, textRect, that.textPosition, textWidth, textHeight);
                        break;
                    case "textAboveImage":
                        switch (that.textPosition) {
                            case "topRight":
                            case "top":
                            case "topLeft":
                                textRect = { left: left, top: top, width: rectWidth, height: textHeight };
                                imageRect = { left: left, top: top + textHeight + offset, width: rectWidth, height: rectHeight - textHeight - offset };
                                break;
                            case "left":
                            case "center":
                            case "right":
                                textRect = { left: left, top: center - imgHeight / 2 - textHeight / 2 - offset / 2, width: rectWidth, height: textHeight };
                                imageRect = { left: left, top: textRect.top + offset + textHeight, width: rectWidth, height: rectHeight - textRect.top - offset - textHeight };
                                break;
                            case "bottomLeft":
                            case "bottom":
                            case "bottomRight":
                                textRect = { left: left, top: bottom - imgHeight - textHeight - offset, width: rectWidth, height: textHeight };
                                imageRect = { left: left, top: textRect.top + offset + textHeight, width: rectWidth, height: imgHeight };
                                break;

                        }
                        drawElement(img, imageRect, that.imgPosition, imgWidth, imgHeight);
                        drawElement(text, textRect, that.textPosition, textWidth, textHeight);

                        break;
                    case "overlay":
                    default:
                        textRect = { left: left, top: top, width: rectWidth, height: rectHeight };
                        imageRect = { left: left, top: top, width: rectWidth, height: rectHeight };

                        drawElement(img, imageRect, that.imgPosition, imgWidth, imgHeight);
                        drawElement(text, textRect, that.textPosition, textWidth, textHeight);

                        break;
                }
            },

            createInstance: function (args) {
                var that = this;
                that._setSize();

                var isMaterial = that.isMaterialized();

                that.buttonObj = new $(that.element);

                if (that.imgSrc != "" || that.textPosition != "" || (that.element.value && that.element.value.indexOf("<") >= 0) || that.value != null) {
                    that.refresh();
                    that._addImage("jqxButton");
                    that.buttonObj = new $(that.element);
                }

                if (!that._ariaDisabled) {
                    that.element.setAttribute('role', 'button');
                }
                if (that.type !== '') {
                    that.element.setAttribute('type', that.type);
                }
                if (!that.overrideTheme) {
                    that.buttonObj.addClass(that.toThemeProperty($.jqx.cssroundedcorners(that.roundedCorners)));
                    if (that.enableDefault) {
                        that.buttonObj.addClass(that.toThemeProperty('jqx-button'));
                    }
                    that.buttonObj.addClass(that.toThemeProperty('jqx-widget'));
                }

                that.isTouchDevice = $.jqx.mobile.isTouchDevice();
                if (!that._ariaDisabled) {
                    $.jqx.aria(this);
                }

                if (that.cursor != 'arrow') {
                    if (!that.disabled) {
                        that.element.style.cursor = that.cursor;
                    }
                    else {
                        that.element.style.cursor = "arrow";
                    }
                }

                var eventNames = 'mouseenter mouseleave mousedown focus blur';
                if (that._scrollAreaButton) {
                    var eventNames = 'mousedown';
                }

                if (that.isTouchDevice) {
                    that.addHandler(that.host, $.jqx.mobile.getTouchEventName('touchstart'), function (event) {
                        that.isPressed = true;
                        that.refresh();
                    });
                    that.addHandler($(document), $.jqx.mobile.getTouchEventName('touchend') + "." + that.element.id, function (event) {
                        that.isPressed = false;
                        that.refresh();
                    });
                }

                that.addHandler(that.host, eventNames, function (event) {
                    switch (event.type) {
                        case 'mouseenter':
                            if (!that.isTouchDevice) {
                                if (!that.disabled && that.enableHover) {
                                    that.isMouseOver = true;
                                    that.refresh();
                                }
                            }
                            break;
                        case 'mouseleave':
                            if (!that.isTouchDevice) {
                                if (!that.disabled && that.enableHover) {
                                    that.isMouseOver = false;
                                    that.refresh();
                                }
                            }
                            break;
                        case 'mousedown':
                            if (!that.disabled) {
                                that.isPressed = true;
                                that.refresh();
                            }
                            break;
                        case 'focus':
                            if (!that.disabled) {
                                that.isFocused = true;
                                that.refresh();
                            }
                            break;
                        case 'blur':
                            if (!that.disabled) {
                                that.isFocused = false;
                                that.refresh();
                            }
                            break;
                    }
                });

                that.mouseupfunc = function (event) {
                    if (!that.disabled) {
                        if (that.isPressed || that.isMouseOver) {
                            that.isPressed = false;
                            that.refresh();
                        }
                    }
                }

                that.addHandler(document, 'mouseup.button' + that.element.id, that.mouseupfunc);

                try {
                    if (document.referrer != "" || window.frameElement) {
                        if (window.top != null && window.top != window.that) {
                            var parentLocation = '';
                            if (window.parent && document.referrer) {
                                parentLocation = document.referrer;
                            }

                            if (parentLocation.indexOf(document.location.host) != -1) {
                                if (window.top.document) {
                                    window.top.document.addEventListener('mouseup', that._topDocumentMouseupHandler);
                                }
                            }
                        }
                    }
                }
                catch (error) {
                }

                that.propertyChangeMap['roundedCorners'] = function (instance, key, oldVal, value) {
                    instance.buttonObj.removeClass(instance.toThemeProperty($.jqx.cssroundedcorners(oldVal)));
                    instance.buttonObj.addClass(instance.toThemeProperty($.jqx.cssroundedcorners(value)));
                };
                that.propertyChangeMap['disabled'] = function (instance, key, oldVal, value) {
                    if (oldVal != value) {
                        instance.refresh();
                        instance.element.setAttribute('disabled', value);
                        instance.element.disabled = value;
                        if (!value) {
                            instance.element.style.cursor = instance.cursor;
                        }
                        else {
                            instance.element.style.cursor = 'default';
                        }

                        $.jqx.aria(instance, "aria-disabled", instance.disabled);
                    }
                };
                that.propertyChangeMap['rtl'] = function (instance, key, oldVal, value) {
                    if (oldVal != value) {
                        instance.refresh();
                    }
                };
                that.propertyChangeMap['template'] = function (instance, key, oldVal, value) {
                    if (oldVal != value) {
                        instance.buttonObj.removeClass(instance.toThemeProperty("jqx-" + oldVal));
                        instance.refresh();
                    }
                };
                that.propertyChangeMap['theme'] = function (instance, key, oldVal, value) {
                    instance.buttonObj.removeClass(instance.element);

                    if (oldVal) {
                        instance.buttonObj.removeClass('jqx-button-' + oldVal);
                        instance.buttonObj.removeClass('jqx-widget-' + oldVal);
                        instance.buttonObj.removeClass('jqx-fill-state-normal-' + oldVal);
                        instance.buttonObj.removeClass(instance.toThemeProperty($.jqx.cssroundedcorners(instance.roundedCorners)) + '-' + oldVal);
                    }

                    if (instance.enableDefault) {
                        instance.buttonObj.addClass(instance.toThemeProperty('jqx-button'));
                    }
                    instance.buttonObj.addClass(instance.toThemeProperty('jqx-widget'));
                    if (!instance.overrideTheme) {
                        instance.buttonObj.addClass(instance.toThemeProperty($.jqx.cssroundedcorners(instance.roundedCorners)));
                    }
                    instance._oldCSSCurrent = null;
                    instance.refresh();
                };

                if (that.disabled) {
                    that.element.disabled = true;
                    that.element.setAttribute('disabled', 'true');
                }

                if (that.textPosition) {
                    $.jqx.utilities.resize(this.host, function () {
                        that._positionTextAndImage();
                    });
                }
            }, // createInstance

            resize: function (width, height) {
                this.width = width;
                this.height = height;
                this._setSize();
            },

            val: function (value) {
                var that = this;
                var input = that.host.find('input');
                if (input.length > 0) {
                    if (arguments.length == 0 || typeof (value) == "object") {
                        return input.val();
                    }
                    input.val(value);
                    that.refresh();
                    return input.val();
                }

                if (arguments.length == 0 || typeof (value) == "object") {
                    if (that.element.nodeName.toLowerCase() == "button") {
                        return $(that.element).text();
                    }
                    return that.element.value;
                }

                if (arguments.length > 0 && that._text) {
                    that._text.innerHTML = arguments[0];
                    that.refresh();

                    return;
                }
                else if (arguments.length > 0 && that.element.nodeName === 'DIV') {
                    that.element.innerHTML = arguments[0];
                    that.refresh();
                }

                that.element.value = arguments[0];
                if (that.element.nodeName.toLowerCase() == "button") {
                    $(that.element).html(arguments[0]);
                }

                that.refresh();
            },

            _setSize: function () {
                var that = this;
                var height = that.height;
                var width = that.width;

                if (height) {
                    if (!isNaN(height)) {
                        height = height + "px";
                    }
                    that.element.style.height = height;
                }

                if (width) {
                    if (!isNaN(width)) {
                        width = width + "px";
                    }
                    that.element.style.width = width;
                }
            },

            _removeHandlers: function () {
                var that = this;
                that.removeHandler(that.host, 'selectstart');
                that.removeHandler(that.host, 'click');
                that.removeHandler(that.host, 'focus');
                that.removeHandler(that.host, 'blur');
                that.removeHandler(that.host, 'mouseenter');
                that.removeHandler(that.host, 'mouseleave');
                that.removeHandler(that.host, 'mousedown');
                that.removeHandler($(document), 'mouseup.button' + that.element.id, that.mouseupfunc);
                if (that.isTouchDevice) {
                    that.removeHandler(that.host, $.jqx.mobile.getTouchEventName('touchstart'));
                    that.removeHandler($(document), $.jqx.mobile.getTouchEventName('touchend') + "." + that.element.id);
                }
                that.mouseupfunc = null;
                delete that.mouseupfunc;
            },

            focus: function () {
                this.host.focus();
            },

            destroy: function () {
                var that = this;
                that._removeHandlers();
                var vars = $.data(that.element, "jqxButton");
                if (vars) {
                    delete vars.instance;
                }
                that.host.removeClass();
                that.host.removeData();
                that.host.remove();
                delete that.set;
                delete that.get;
                delete that.call;
                delete that.element;
                delete that.host;
            },

            render: function () {
                this.refresh();
            },

            propertiesChangedHandler: function (object, oldValues, newValues) {
                if (newValues && newValues.width && newValues.height && Object.keys(newValues).length == 2) {
                    object._setSize();
                    object.refresh();
                }
            },

            propertyChangedHandler: function (object, key, oldvalue, value) {
                if (this.isInitialized == undefined || this.isInitialized == false)
                    return;

                if (value == oldvalue) {
                    return;
                }

                if (object.batchUpdate && object.batchUpdate.width && object.batchUpdate.height && Object.keys(object.batchUpdate).length == 2) {
                    return;
                }

                if (key === "type") {
                    object.element.setAttribute('type', value);
                }
                if (key == "textImageRelation" || key == "textPosition" || key == "imgPosition") {
                    if (object._img) {
                        object._positionTextAndImage();
                    }
                    else object._addImage("jqxButton");
                }
                if (key == "imgSrc" || key == "imgWidth" || key == "imgHeight") {
                    object._addImage("jqxButton");
                }

                if (key === "value") {
                    object.val(value);
                }

                if (key == "width" || key == "height") {
                    object._setSize();
                    object.refresh();
                }
            },

            refresh: function () {
                var that = this;
                if (that.overrideTheme)
                    return;

                var cssFocused = that.toThemeProperty('jqx-fill-state-focus');
                var cssDisabled = that.toThemeProperty('jqx-fill-state-disabled');
                var cssNormal = that.toThemeProperty('jqx-fill-state-normal');

                if (!that.enableDefault) {
                    cssNormal = "";
                }

                var cssHover = that.toThemeProperty('jqx-fill-state-hover');
                var cssPressed = that.toThemeProperty('jqx-fill-state-pressed');
                var cssPressedHover = that.toThemeProperty('jqx-fill-state-pressed');
                if (!that.enablePressed) {
                    cssPressed = "";
                }
                var cssCurrent = '';

                if (!that.host) {
                    return;
                }

                that.element.disabled = that.disabled;

                if (that.disabled) {
                    if (that._oldCSSCurrent) {
                        that.buttonObj.removeClass(that._oldCSSCurrent);
                    }
                    cssCurrent = cssNormal + " " + cssDisabled;
                    if (that.template !== "default" && that.template !== "") {
                        cssCurrent += " " + "jqx-" + that.template;
                        if (that.theme != "") {
                            cssCurrent += " " + "jqx-" + that.template + "-" + that.theme;
                        }
                    }
                    that.buttonObj.addClass(cssCurrent);
                    that._oldCSSCurrent = cssCurrent;
                    return;
                }
                else {
                    if (that.isMouseOver && !that.isTouchDevice) {
                        if (that.isPressed)
                            cssCurrent = cssPressedHover;
                        else
                            cssCurrent = cssHover;
                    }
                    else {
                        if (that.isPressed)
                            cssCurrent = cssPressed;
                        else
                            cssCurrent = cssNormal;
                    }
                }

                if (that.isFocused) {
                    cssCurrent += " " + cssFocused;
                }

                if (that.template !== "default" && that.template !== "") {
                    cssCurrent += " " + "jqx-" + that.template;
                    if (that.theme != "") {
                        cssCurrent += " " + "jqx-" + that.template + "-" + that.theme;
                    }
                }

                if (cssCurrent != that._oldCSSCurrent) {
                    if (that._oldCSSCurrent) {
                        that.buttonObj.removeClass(that._oldCSSCurrent);
                    }
                    that.buttonObj.addClass(cssCurrent);
                    that._oldCSSCurrent = cssCurrent;
                }
                if (that.rtl) {
                    that.buttonObj.addClass(that.toThemeProperty('jqx-rtl'));
                    that.element.style.direction = 'rtl';
                }


                if (that.isMaterialized()) {
                    that.host.addClass('buttonRipple');
                }
            }
        });

        //// LinkButton
        $.jqx.jqxWidget("jqxLinkButton", "", {});

        $.extend($.jqx._jqxLinkButton.prototype, {
            defineInstance: function () {
                // enables / disables the button
                this.disabled = false;
                // sets height to the button.
                this.height = null;
                // sets width to the button.
                this.width = null;
                this.rtl = false;
                this.href = null;
            },

            createInstance: function (args) {
                var that = this;
                this.host.onselectstart = function () { return false; };
                this.host.attr('role', 'button');

                var height = this.height || this.element.offsetHeight;
                var width = this.width || this.element.offsetWidth;
                this.href = this.element.getAttribute('href');
                this.target = this.element.getAttribute('target');
                this.content = this.host.text();
                this.element.innerHTML = "";
                var wrapElement = document.createElement('input');
                wrapElement.type = "button";
                wrapElement.className = "jqx-wrapper " + this.toThemeProperty('jqx-reset');

                this._setSize(wrapElement, width, height);

                wrapElement.value = this.content;
                var helper = new $(this.element);
                helper.addClass(this.toThemeProperty('jqx-link'));
                this.element.style.color = 'inherit';
                this.element.appendChild(wrapElement);
                this._setSize(wrapElement, width, height);

                var param = args == undefined ? {} : args[0] || {};
                $(wrapElement).jqxButton(param);
                this.wrapElement = wrapElement;
                if (this.disabled) {
                    this.element.disabled = true;
                }

                this.propertyChangeMap['disabled'] = function (instance, key, oldVal, value) {
                    instance.element.disabled = value;
                    instance.wrapElement.jqxButton({ disabled: value });
                }

                this.addHandler($(wrapElement), 'click', function (event) {
                    if (!this.disabled) {
                        that.onclick(event);
                    }
                    return false;
                });
            },

            _setSize: function (element, width, height) {
                var that = this;

                if (height) {
                    if (!isNaN(height)) {
                        height = height + "px";
                    }
                    element.style.height = height;
                }

                if (width) {
                    if (!isNaN(width)) {
                        width = width + "px";
                    }
                    element.style.width = width;
                }
            },


            onclick: function (event) {
                if (this.target != null) {
                    window.open(this.href, this.target);
                }
                else {
                    window.location = this.href;
                }
            }
        });
        //// End of LinkButton

        //// RepeatButton
        $.jqx.jqxWidget("jqxRepeatButton", "jqxButton", {});

        $.extend($.jqx._jqxRepeatButton.prototype, {
            defineInstance: function () {
                this.delay = 50;
            },

            createInstance: function (args) {
                var that = this;

                var isTouchDevice = $.jqx.mobile.isTouchDevice();

                var up = !isTouchDevice ? 'mouseup.' + this.base.element.id : 'touchend.' + this.base.element.id;
                var down = !isTouchDevice ? 'mousedown.' + this.base.element.id : 'touchstart.' + this.base.element.id;

                this.addHandler($(document), up, function (event) {
                    if (that.timeout != null) {
                        clearTimeout(that.timeout);
                        that.timeout = null;
                        that.refresh();
                    }
                    if (that.timer != undefined) {
                        clearInterval(that.timer);
                        that.timer = null;
                        that.refresh();
                    }
                });

                this.addHandler(this.base.host, down, function (event) {
                    if (that.timer != null) {
                        clearInterval(that.timer);
                    }

                    that.timeout = setTimeout(function () {
                        clearInterval(that.timer);
                        that.timer = setInterval(function (event) { that.ontimer(event); }, that.delay);
                    }, 150);
                });

                this.mousemovefunc = function (event) {
                    if (!isTouchDevice) {
                        if (event.which == 0) {
                            if (that.timer != null) {
                                clearInterval(that.timer);
                                that.timer = null;
                            }
                        }
                    }
                }

                this.addHandler(this.base.host, 'mousemove', this.mousemovefunc);
            },

            destroy: function () {
                var isTouchDevice = $.jqx.mobile.isTouchDevice();
                var up = !isTouchDevice ? 'mouseup.' + this.base.element.id : 'touchend.' + this.base.element.id;
                var down = !isTouchDevice ? 'mousedown.' + this.base.element.id : 'touchstart.' + this.base.element.id;
                this.removeHandler(this.base.host, 'mousemove', this.mousemovefunc);
                this.removeHandler(this.base.host, down);
                this.removeHandler($(document), up);
                this.timer = null;
                delete this.mousemovefunc;
                delete this.timer;
                var vars = $.data(this.base.element, "jqxRepeatButton");
                if (vars) {
                    delete vars.instance;
                }
                $(this.base.element).removeData();
                this.base.destroy();
                delete this.base;

            },

            stop: function () {
                clearInterval(this.timer);
                this.timer = null;
            },

            ontimer: function (event) {
                var event = new $.Event('click');
                if (this.base != null && this.base.host != null) {
                    this.base.host.trigger(event);
                }
            }
        });
        //// End of RepeatButton
        //// ToggleButton
        $.jqx.jqxWidget("jqxToggleButton", "jqxButton", {});

        $.extend($.jqx._jqxToggleButton.prototype, {
            defineInstance: function () {
                this.toggled = false;
                this.uiToggle = true;
                this.aria =
                {
                    "aria-checked": { name: "toggled", type: "boolean" },
                    "aria-disabled": { name: "disabled", type: "boolean" }
                };
            },

            createInstance: function (args) {
                var that = this;
                that.base.overrideTheme = true;
                that.isTouchDevice = $.jqx.mobile.isTouchDevice();
                $.jqx.aria(this);
                that.base.host.attr('role', 'checkbox');

                that.propertyChangeMap['roundedCorners'] = function (instance, key, oldVal, value) {
                    instance.base.buttonObj.removeClass(instance.toThemeProperty($.jqx.cssroundedcorners(oldVal)));
                    instance.base.buttonObj.addClass(instance.toThemeProperty($.jqx.cssroundedcorners(value)));
                };

                that.propertyChangeMap['toggled'] = function (instance, key, oldVal, value) {
                    instance.refresh();
                };
                that.propertyChangeMap['disabled'] = function (instance, key, oldVal, value) {
                    instance.base.disabled = value;
                    instance.refresh();
                };

                that.addHandler(that.base.host, 'click', function (event) {
                    if (!that.base.disabled && that.uiToggle) {
                        that.toggle();
                    }
                });

                if (!that.isTouchDevice) {
                    that.addHandler(that.base.host, 'mouseenter', function (event) {
                        if (!that.base.disabled) {
                            that.refresh();
                        }
                    });

                    that.addHandler(that.base.host, 'mouseleave', function (event) {
                        if (!that.base.disabled) {
                            that.refresh();
                        }
                    });
                }

                that.addHandler(that.base.host, 'mousedown', function (event) {
                    if (!that.base.disabled) {
                        that.refresh();
                    }
                });

                that.addHandler($(document), 'mouseup.togglebutton' + that.base.element.id, function (event) {
                    if (!that.base.disabled) {
                        that.refresh();
                    }
                });
            },

            destroy: function () {
                this._removeHandlers();
                this.base.destroy();
            },

            _removeHandlers: function () {
                this.removeHandler(this.base.host, 'click');
                this.removeHandler(this.base.host, 'mouseenter');
                this.removeHandler(this.base.host, 'mouseleave');
                this.removeHandler(this.base.host, 'mousedown');
                this.removeHandler($(document), 'mouseup.togglebutton' + this.base.element.id);
            },

            toggle: function () {
                this.toggled = !this.toggled;
                this.refresh();
                $.jqx.aria(this, "aria-checked", this.toggled);
            },

            unCheck: function () {
                this.toggled = false;
                this.refresh();
            },

            check: function () {
                this.toggled = true;
                this.refresh();
            },

            refresh: function () {
                var that = this;
                var cssDisabled = that.base.toThemeProperty('jqx-fill-state-disabled');
                var cssNormal = that.base.toThemeProperty('jqx-fill-state-normal');
                if (!that.base.enableDefault) {
                    cssNormal = "";
                }
                var cssHover = that.base.toThemeProperty('jqx-fill-state-hover');
                var cssPressed = that.base.toThemeProperty('jqx-fill-state-pressed');
                var cssPressedHover = that.base.toThemeProperty('jqx-fill-state-pressed');
                var cssCurrent = '';
                that.base.element.disabled = that.base.disabled;

                if (that.base.disabled) {
                    cssCurrent = cssNormal + " " + cssDisabled;
                    that.base.buttonObj.addClass(cssCurrent);
                    return;
                }
                else {
                    if (that.base.isMouseOver && !that.isTouchDevice) {
                        if (that.base.isPressed || that.toggled)
                            cssCurrent = cssPressedHover;
                        else
                            cssCurrent = cssHover;
                    }
                    else {
                        if (that.base.isPressed || that.toggled)
                            cssCurrent = cssPressed;
                        else
                            cssCurrent = cssNormal;
                    }
                }

                if (that.base.template !== "default" && that.base.template !== "") {
                    cssCurrent += " " + "jqx-" + that.base.template;
                    if (that.base.theme != "") {
                        cssCurrent += " " + "jqx-" + that.template + "-" + that.base.theme;
                    }
                }

                if (that.base.buttonObj.hasClass(cssDisabled) && cssDisabled != cssCurrent) {
                    that.base.buttonObj.removeClass(cssDisabled);
                }

                if (that.base.buttonObj.hasClass(cssNormal) && cssNormal != cssCurrent) {
                    that.base.buttonObj.removeClass(cssNormal);
                }

                if (that.base.buttonObj.hasClass(cssHover) && cssHover != cssCurrent) {
                    that.base.buttonObj.removeClass(cssHover);
                }

                if (that.base.buttonObj.hasClass(cssPressed) && cssPressed != cssCurrent) {
                    that.base.buttonObj.removeClass(cssPressed);
                }

                if (that.base.buttonObj.hasClass(cssPressedHover) && cssPressedHover != cssCurrent) {
                    that.base.buttonObj.removeClass(cssPressedHover);
                }

                if (!that.base.buttonObj.hasClass(cssCurrent)) {
                    that.base.buttonObj.addClass(cssCurrent);
                }
            },

            _topDocumentMouseupHandler: function (event) {
                var that = this;
                that.isPressed = false;
                that.refresh();
            }
        });
        //// End of ToggleButton

    })(jqxBaseFramework);
})();



/***/ }),

/***/ 5459:
/***/ ((module, exports, __webpack_require__) => {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/* tslint:disable */
/* eslint-disable */
(function(){
	if (typeof document === 'undefined') { 
		return;
	}
		
	var oldBrowser = document.all && !document.addEventListener;
	if (!oldBrowser) {
		(function (window, undefined) {
			var
				rootJQXLite,
				readyList,
				document = window.document,
				location = window.location,
				navigator = window.navigator,
				_JQXLite = window.JQXLite,
				_$ = window.$,

				// Save a reference to some core methods
				core_push = Array.prototype.push,
				core_slice = Array.prototype.slice,
				core_indexOf = Array.prototype.indexOf,
				core_toString = Object.prototype.toString,
				core_hasOwn = Object.prototype.hasOwnProperty,
				core_trim = String.prototype.trim,

				// Define a local copy of JQXLite
				JQXLite = function (selector, context) {
					// The JQXLite object is actually just the init constructor 'enhanced'
					return new JQXLite.fn.init(selector, context, rootJQXLite);
				},

				// Used for matching numbers
				core_pnum = /[\-+]?(?:\d*\.|)\d+(?:[eE][\-+]?\d+|)/.source,

				// Used for detecting and trimming whitespace
				core_rnotwhite = /\S/,
				core_rspace = /\s+/,

				// Make sure we trim BOM and NBSP (here's looking at you, Safari 5.0 and IE)
				rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,

				// A simple way to check for HTML strings
				// Prioritize #id over <tag> to avoid XSS via location.hash (#9521)
				rquickExpr = /^(?:[^#<]*(<[\w\W]+>)[^>]*$|#([\w\-]*)$)/,

				// Match a standalone tag
				rsingleTag = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,

				// JSON RegExp
				rvalidchars = /^[\],:{}\s]*$/,
				rvalidbraces = /(?:^|:|,)(?:\s*\[)+/g,
				rvalidescape = /\\(?:["\\\/bfnrt]|u[\da-fA-F]{4})/g,
				rvalidtokens = /"[^"\\\r\n]*"|true|false|null|-?(?:\d\d*\.|)\d+(?:[eE][\-+]?\d+|)/g,

				// Matches dashed string for camelizing
				rmsPrefix = /^-ms-/,
				rdashAlpha = /-([\da-z])/gi,

				// Used by JQXLite.camelCase as callback to replace()
				fcamelCase = function (all, letter) {
					return (letter + "").toUpperCase();
				},

				// The ready event handler and self cleanup method
				DOMContentLoaded = function () {
					if (document.addEventListener) {
						document.removeEventListener("DOMContentLoaded", DOMContentLoaded, false);
						JQXLite.ready();
					} else if (document.readyState === "complete") {
						// we're here because readyState === "complete" in oldIE
						// which is good enough for us to call the dom ready!
						document.detachEvent("onreadystatechange", DOMContentLoaded);
						JQXLite.ready();
					}
				},

				// [[Class]] -> type pairs
				class2type = {};

			JQXLite.fn = JQXLite.prototype = {
				constructor: JQXLite,
				init: function (selector, context, rootJQXLite) {
					var match, elem, ret, doc;

					// Handle $(""), $(null), $(undefined), $(false)
					if (!selector) {
						return this;
					}

					// Handle $(DOMElement)
					if (selector.nodeType) {
						this.context = this[0] = selector;
						this.length = 1;
						return this;
					}

					// Handle HTML strings
					if (typeof selector === "string") {
						if (selector.charAt(0) === "<" && selector.charAt(selector.length - 1) === ">" && selector.length >= 3) {
							// Assume that strings that start and end with <> are HTML and skip the regex check
							match = [null, selector, null];

						} else {
							match = rquickExpr.exec(selector);
						}

						// Match html or make sure no context is specified for #id
						if (match && (match[1] || !context)) {

							// HANDLE: $(html) -> $(array)
							if (match[1]) {
								context = context instanceof JQXLite ? context[0] : context;
								doc = (context && context.nodeType ? context.ownerDocument || context : document);

								// scripts is true for back-compat
								selector = JQXLite.parseHTML(match[1], doc, true);
								if (rsingleTag.test(match[1]) && JQXLite.isPlainObject(context)) {
									this.attr.call(selector, context, true);
								}

								return JQXLite.merge(this, selector);

								// HANDLE: $(#id)
							} else {
								elem = document.getElementById(match[2]);

								// Check parentNode to catch when Blackberry 4.6 returns
								// nodes that are no longer in the document #6963
								if (elem && elem.parentNode) {
									// Handle the case where IE and Opera return items
									// by name instead of ID
									if (elem.id !== match[2]) {
										return rootJQXLite.find(selector);
									}

									// Otherwise, we inject the element directly into the JQXLite object
									this.length = 1;
									this[0] = elem;
								}

								this.context = document;
								this.selector = selector;
								return this;
							}

							// HANDLE: $(expr, $(...))
						} else if (!context || context.jqx) {
							return (context || rootJQXLite).find(selector);

							// HANDLE: $(expr, context)
							// (which is just equivalent to: $(context).find(expr)
						} else {
							return this.constructor(context).find(selector);
						}

						// HANDLE: $(function)
						// Shortcut for document ready
					} else if (JQXLite.isFunction(selector)) {
						return rootJQXLite.ready(selector);
					}

					if (selector.selector !== undefined) {
						this.selector = selector.selector;
						this.context = selector.context;
					}

					return JQXLite.makeArray(selector, this);
				},

				// Start with an empty selector
				selector: "",

				// The current version of JQXLite being used
				jqx: "4.5.0",

				// The default length of a JQXLite object is 0
				length: 0,

				// The number of elements contained in the matched element set
				size: function () {
					return this.length;
				},

				toArray: function () {
					return core_slice.call(this);
				},

				// Get the Nth element in the matched element set OR
				// Get the whole matched element set as a clean array
				get: function (num) {
					return num == null ?

						// Return a 'clean' array
						this.toArray() :

						// Return just the object
						(num < 0 ? this[this.length + num] : this[num]);
				},

				// Take an array of elements and push it onto the stack
				// (returning the new matched element set)
				pushStack: function (elems, name, selector) {

					// Build a new JQXLite matched element set
					var ret = JQXLite.merge(this.constructor(), elems);

					// Add the old object onto the stack (as a reference)
					ret.prevObject = this;

					ret.context = this.context;

					if (name === "find") {
						ret.selector = this.selector + (this.selector ? " " : "") + selector;
					} else if (name) {
						ret.selector = this.selector + "." + name + "(" + selector + ")";
					}

					// Return the newly-formed element set
					return ret;
				},

				// Execute a callback for every element in the matched set.
				// (You can seed the arguments with an array of args, but this is
				// only used internally.)
				each: function (callback, args) {
					return JQXLite.each(this, callback, args);
				},

				ready: function (fn) {
					// Add the callback
					JQXLite.ready.promise().done(fn);

					return this;
				},

				eq: function (i) {
					i = +i;
					return i === -1 ?
						this.slice(i) :
						this.slice(i, i + 1);
				},

				first: function () {
					return this.eq(0);
				},

				last: function () {
					return this.eq(-1);
				},

				slice: function () {
					return this.pushStack(core_slice.apply(this, arguments),
						"slice", core_slice.call(arguments).join(","));
				},

				map: function (callback) {
					return this.pushStack(JQXLite.map(this, function (elem, i) {
						return callback.call(elem, i, elem);
					}));
				},

				end: function () {
					return this.prevObject || this.constructor(null);
				},

				// For internal use only.
				// Behaves like an Array's method, not like a JQXLite method.
				push: core_push,
				sort: [].sort,
				splice: [].splice
			};

			// Give the init function the JQXLite prototype for later instantiation
			JQXLite.fn.init.prototype = JQXLite.fn;

			JQXLite.extend = JQXLite.fn.extend = function () {
				var options, name, src, copy, copyIsArray, clone,
					target = arguments[0] || {},
					i = 1,
					length = arguments.length,
					deep = false;

				// Handle a deep copy situation
				if (typeof target === "boolean") {
					deep = target;
					target = arguments[1] || {};
					// skip the boolean and the target
					i = 2;
				}

				// Handle case when target is a string or something (possible in deep copy)
				if (typeof target !== "object" && !JQXLite.isFunction(target)) {
					target = {};
				}

				// extend JQXLite itself if only one argument is passed
				if (length === i) {
					target = this;
					--i;
				}

				for (; i < length; i++) {
					// Only deal with non-null/undefined values
					if ((options = arguments[i]) != null) {
						// Extend the base object
						for (name in options) {
							src = target[name];
							copy = options[name];

							// Prevent never-ending loop
							if (target === copy) {
								continue;
							}

							// Recurse if we're merging plain objects or arrays
							if (deep && copy && (JQXLite.isPlainObject(copy) || (copyIsArray = JQXLite.isArray(copy)))) {
								if (copyIsArray) {
									copyIsArray = false;
									clone = src && JQXLite.isArray(src) ? src : [];

								} else {
									clone = src && JQXLite.isPlainObject(src) ? src : {};
								}

								// Never move original objects, clone them
								target[name] = JQXLite.extend(deep, clone, copy);

								// Don't bring in undefined values
							} else if (copy !== undefined) {
								target[name] = copy;
							}
						}
					}
				}

				// Return the modified object
				return target;
			};

			JQXLite.extend({
				noConflict: function (deep) {
					if (window.$ === JQXLite) {
						window.$ = _$;
					}

					if (deep && window.JQXLite === JQXLite) {
						window.JQXLite = _JQXLite;
					}

					return JQXLite;
				},

				// Is the DOM ready to be used? Set to true once it occurs.
				isReady: false,

				// A counter to track how many items to wait for before
				// the ready event fires. See #6781
				readyWait: 1,

				// Hold (or release) the ready event
				holdReady: function (hold) {
					if (hold) {
						JQXLite.readyWait++;
					} else {
						JQXLite.ready(true);
					}
				},

				// Handle when the DOM is ready
				ready: function (wait) {

					// Abort if there are pending holds or we're already ready
					if (wait === true ? --JQXLite.readyWait : JQXLite.isReady) {
						return;
					}

					// Make sure body exists, at least, in case IE gets a little overzealous (ticket #5443).
					if (!document.body) {
						return setTimeout(JQXLite.ready, 1);
					}

					// Remember that the DOM is ready
					JQXLite.isReady = true;

					// If a normal DOM Ready event fired, decrement, and wait if need be
					if (wait !== true && --JQXLite.readyWait > 0) {
						return;
					}

					// If there are functions bound, to execute
					readyList.resolveWith(document, [JQXLite]);

					// Trigger any bound ready events
					if (JQXLite.fn.trigger) {
						JQXLite(document).trigger("ready").off("ready");
					}
				},

				// See test/unit/core.js for details concerning isFunction.
				// Since version 1.3, DOM methods and functions like alert
				// aren't supported. They return false on IE (#2968).
				isFunction: function (obj) {
					return JQXLite.type(obj) === "function";
				},

				isArray: Array.isArray || function (obj) {
					return JQXLite.type(obj) === "array";
				},

				isWindow: function (obj) {
					return obj != null && obj == obj.window;
				},

				isNumeric: function (obj) {
					return !isNaN(parseFloat(obj)) && isFinite(obj);
				},

				type: function (obj) {
					return obj == null ?
						String(obj) :
						class2type[core_toString.call(obj)] || "object";
				},

				isPlainObject: function (obj) {
					// Must be an Object.
					// Because of IE, we also have to check the presence of the constructor property.
					// Make sure that DOM nodes and window objects don't pass through, as well
					if (!obj || JQXLite.type(obj) !== "object" || obj.nodeType || JQXLite.isWindow(obj)) {
						return false;
					}

					try {
						// Not own constructor property must be Object
						if (obj.constructor &&
							!core_hasOwn.call(obj, "constructor") &&
							!core_hasOwn.call(obj.constructor.prototype, "isPrototypeOf")) {
							return false;
						}
					} catch (e) {
						// IE8,9 Will throw exceptions on certain host objects #9897
						return false;
					}

					// Own properties are enumerated firstly, so to speed up,
					// if last one is own, then all properties are own.

					var key;
					for (key in obj) { }

					return key === undefined || core_hasOwn.call(obj, key);
				},

				isEmptyObject: function (obj) {
					var name;
					for (name in obj) {
						return false;
					}
					return true;
				},

				error: function (msg) {
					throw new Error(msg);
				},

				// data: string of html
				// context (optional): If specified, the fragment will be created in this context, defaults to document
				// scripts (optional): If true, will include scripts passed in the html string
				parseHTML: function (data, context, scripts) {
					var parsed;
					if (!data || typeof data !== "string") {
						return null;
					}
					if (typeof context === "boolean") {
						scripts = context;
						context = 0;
					}
					context = context || document;

					// Single tag
					if ((parsed = rsingleTag.exec(data))) {
						return [context.createElement(parsed[1])];
					}

					parsed = JQXLite.buildFragment([data], context, scripts ? null : []);
					return JQXLite.merge([],
						(parsed.cacheable ? JQXLite.clone(parsed.fragment) : parsed.fragment).childNodes);
				},

				parseJSON: function (data) {
					if (!data || typeof data !== "string") {
						return null;
					}

					// Make sure leading/trailing whitespace is removed (IE can't handle it)
					data = JQXLite.trim(data);

					// Attempt to parse using the native JSON parser first
					if (window.JSON && window.JSON.parse) {
						return window.JSON.parse(data);
					}

					// Make sure the incoming data is actual JSON
					// Logic borrowed from http://json.org/json2.js
					if (rvalidchars.test(data.replace(rvalidescape, "@")
						.replace(rvalidtokens, "]")
						.replace(rvalidbraces, ""))) {

						return (new Function("return " + data))();

					}
					JQXLite.error("Invalid JSON: " + data);
				},

				// Cross-browser xml parsing
				parseXML: function (data) {
					var xml, tmp;
					if (!data || typeof data !== "string") {
						return null;
					}
					try {
						if (window.DOMParser) { // Standard
							tmp = new DOMParser();
							xml = tmp.parseFromString(data, "text/xml");
						} else { // IE
							xml = new ActiveXObject("Microsoft.XMLDOM");
							xml.async = "false";
							xml.loadXML(data);
						}
					} catch (e) {
						xml = undefined;
					}
					if (!xml || !xml.documentElement || xml.getElementsByTagName("parsererror").length) {
						JQXLite.error("Invalid XML: " + data);
					}
					return xml;
				},

				noop: function () { },

				// Evaluates a script in a global context
				// Workarounds based on findings by Jim Driscoll
				// http://weblogs.java.net/blog/driscoll/archive/2009/09/08/eval-javascript-global-context
				globalEval: function (data) {
					if (data && core_rnotwhite.test(data)) {
						// We use execScript on Internet Explorer
						// We use an anonymous function so that context is window
						// rather than JQXLite in Firefox
						(window.execScript || function (data) {
							window["eval"].call(window, data);
						})(data);
					}
				},

				// Convert dashed to camelCase; used by the css and data modules
				// Microsoft forgot to hump their vendor prefix (#9572)
				camelCase: function (string) {
					return string.replace(rmsPrefix, "ms-").replace(rdashAlpha, fcamelCase);
				},

				nodeName: function (elem, name) {
					return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();
				},

				// args is for internal usage only
				each: function (obj, callback, args) {
					var name,
						i = 0,
						length = obj.length,
						isObj = length === undefined || JQXLite.isFunction(obj);

					if (args) {
						if (isObj) {
							for (name in obj) {
								if (callback.apply(obj[name], args) === false) {
									break;
								}
							}
						} else {
							for (; i < length;) {
								if (callback.apply(obj[i++], args) === false) {
									break;
								}
							}
						}

						// A special, fast, case for the most common use of each
					} else {
						if (isObj) {
							for (name in obj) {
								if (callback.call(obj[name], name, obj[name]) === false) {
									break;
								}
							}
						} else {
							for (; i < length;) {
								if (callback.call(obj[i], i, obj[i++]) === false) {
									break;
								}
							}
						}
					}

					return obj;
				},

				// Use native String.trim function wherever possible
				trim: core_trim && !core_trim.call("\uFEFF\xA0") ?
					function (text) {
						return text == null ?
							"" :
							core_trim.call(text);
					} :

					// Otherwise use our own trimming functionality
					function (text) {
						return text == null ?
							"" :
							(text + "").replace(rtrim, "");
					},

				// results is for internal usage only
				makeArray: function (arr, results) {
					var type,
						ret = results || [];

					if (arr != null) {
						// The window, strings (and functions) also have 'length'
						// Tweaked logic slightly to handle Blackberry 4.7 RegExp issues #6930
						type = JQXLite.type(arr);

						if (arr.length == null || type === "string" || type === "function" || type === "regexp" || JQXLite.isWindow(arr)) {
							core_push.call(ret, arr);
						} else {
							JQXLite.merge(ret, arr);
						}
					}

					return ret;
				},

				inArray: function (elem, arr, i) {
					var len;

					if (arr) {
						if (core_indexOf) {
							return core_indexOf.call(arr, elem, i);
						}

						len = arr.length;
						i = i ? i < 0 ? Math.max(0, len + i) : i : 0;

						for (; i < len; i++) {
							// Skip accessing in sparse arrays
							if (i in arr && arr[i] === elem) {
								return i;
							}
						}
					}

					return -1;
				},

				merge: function (first, second) {
					var l = second.length,
						i = first.length,
						j = 0;

					if (typeof l === "number") {
						for (; j < l; j++) {
							first[i++] = second[j];
						}

					} else {
						while (second[j] !== undefined) {
							first[i++] = second[j++];
						}
					}

					first.length = i;

					return first;
				},

				grep: function (elems, callback, inv) {
					var retVal,
						ret = [],
						i = 0,
						length = elems.length;
					inv = !!inv;

					// Go through the array, only saving the items
					// that pass the validator function
					for (; i < length; i++) {
						retVal = !!callback(elems[i], i);
						if (inv !== retVal) {
							ret.push(elems[i]);
						}
					}

					return ret;
				},

				// arg is for internal usage only
				map: function (elems, callback, arg) {
					var value, key,
						ret = [],
						i = 0,
						length = elems.length,
						// jqx objects are treated as arrays
						isArray = elems instanceof JQXLite || length !== undefined && typeof length === "number" && ((length > 0 && elems[0] && elems[length - 1]) || length === 0 || JQXLite.isArray(elems));

					// Go through the array, translating each of the items to their
					if (isArray) {
						for (; i < length; i++) {
							value = callback(elems[i], i, arg);

							if (value != null) {
								ret[ret.length] = value;
							}
						}

						// Go through every key on the object,
					} else {
						for (key in elems) {
							value = callback(elems[key], key, arg);

							if (value != null) {
								ret[ret.length] = value;
							}
						}
					}

					// Flatten any nested arrays
					return ret.concat.apply([], ret);
				},

				// A global GUID counter for objects
				guid: 1,

				// Bind a function to a context, optionally partially applying any
				// arguments.
				proxy: function (fn, context) {
					var tmp, args, proxy;

					if (typeof context === "string") {
						tmp = fn[context];
						context = fn;
						fn = tmp;
					}

					// Quick check to determine if target is callable, in the spec
					// this throws a TypeError, but we will just return undefined.
					if (!JQXLite.isFunction(fn)) {
						return undefined;
					}

					// Simulated bind
					args = core_slice.call(arguments, 2);
					proxy = function () {
						return fn.apply(context, args.concat(core_slice.call(arguments)));
					};

					// Set the guid of unique handler to the same of original handler, so it can be removed
					proxy.guid = fn.guid = fn.guid || JQXLite.guid++;

					return proxy;
				},

				// Multifunctional method to get and set values of a collection
				// The value/s can optionally be executed if it's a function
				access: function (elems, fn, key, value, chainable, emptyGet, pass) {
					var exec,
						bulk = key == null,
						i = 0,
						length = elems.length;

					// Sets many values
					if (key && typeof key === "object") {
						for (i in key) {
							JQXLite.access(elems, fn, i, key[i], 1, emptyGet, value);
						}
						chainable = 1;

						// Sets one value
					} else if (value !== undefined) {
						// Optionally, function values get executed if exec is true
						exec = pass === undefined && JQXLite.isFunction(value);

						if (bulk) {
							// Bulk operations only iterate when executing function values
							if (exec) {
								exec = fn;
								fn = function (elem, key, value) {
									return exec.call(JQXLite(elem), value);
								};

								// Otherwise they run against the entire set
							} else {
								fn.call(elems, value);
								fn = null;
							}
						}

						if (fn) {
							for (; i < length; i++) {
								fn(elems[i], key, exec ? value.call(elems[i], i, fn(elems[i], key)) : value, pass);
							}
						}

						chainable = 1;
					}

					return chainable ?
						elems :

						// Gets
						bulk ?
							fn.call(elems) :
							length ? fn(elems[0], key) : emptyGet;
				},

				now: function () {
					return (new Date()).getTime();
				}
			});

			JQXLite.ready.promise = function (obj) {
				if (!readyList) {

					readyList = JQXLite.Deferred();

					// Catch cases where $(document).ready() is called after the browser event has already occurred.
					// we once tried to use readyState "interactive" here, but it caused issues like the one
					// discovered by ChrisS here: http://bugs.jqx.com/ticket/12282#comment:15
					if (document.readyState === "complete") {
						// Handle it asynchronously to allow scripts the opportunity to delay ready
						setTimeout(JQXLite.ready, 1);

						// Standards-based browsers support DOMContentLoaded
					} else if (document.addEventListener) {
						// Use the handy event callback
						document.addEventListener("DOMContentLoaded", DOMContentLoaded, false);

						// A fallback to window.onload, that will always work
						window.addEventListener("load", JQXLite.ready, false);

						// If IE event model is used
					} else {
						// Ensure firing before onload, maybe late but safe also for iframes
						document.attachEvent("onreadystatechange", DOMContentLoaded);

						// A fallback to window.onload, that will always work
						window.attachEvent("onload", JQXLite.ready);

						// If IE and not a frame
						// continually check to see if the document is ready
						var top = false;

						try {
							top = window.frameElement == null && document.documentElement;
						} catch (e) { }

						if (top && top.doScroll) {
							(function doScrollCheck() {
								if (!JQXLite.isReady) {

									try {
										// Use the trick by Diego Perini
										// http://javascript.nwbox.com/IEContentLoaded/
										top.doScroll("left");
									} catch (e) {
										return setTimeout(doScrollCheck, 50);
									}

									// and execute any waiting functions
									JQXLite.ready();
								}
							})();
						}
					}
				}
				return readyList.promise(obj);
			};

			// Populate the class2type map
			JQXLite.each("Boolean Number String Function Array Date RegExp Object".split(" "), function (i, name) {
				class2type["[object " + name + "]"] = name.toLowerCase();
			});

			// All JQXLite objects should point back to these
			rootJQXLite = JQXLite(document);
			// String to Object options format cache
			var optionsCache = {};

			// Convert String-formatted options into Object-formatted ones and store in cache
			function createOptions(options) {
				var object = optionsCache[options] = {};
				JQXLite.each(options.split(core_rspace), function (_, flag) {
					object[flag] = true;
				});
				return object;
			}

			/*
			 * Create a callback list using the following parameters:
			 *
			 *	options: an optional list of space-separated options that will change how
			 *			the callback list behaves or a more traditional option object
			 *
			 * By default a callback list will act like an event callback list and can be
			 * "fired" multiple times.
			 *
			 * Possible options:
			 *
			 *	once:			will ensure the callback list can only be fired once (like a Deferred)
			 *
			 *	memory:			will keep track of previous values and will call any callback added
			 *					after the list has been fired right away with the latest "memorized"
			 *					values (like a Deferred)
			 *
			 *	unique:			will ensure a callback can only be added once (no duplicate in the list)
			 *
			 *	stopOnFalse:	interrupt callings when a callback returns false
			 *
			 */
			JQXLite.Callbacks = function (options) {

				// Convert options from String-formatted to Object-formatted if needed
				// (we check in cache first)
				options = typeof options === "string" ?
					(optionsCache[options] || createOptions(options)) :
					JQXLite.extend({}, options);

				var // Last fire value (for non-forgettable lists)
					memory,
					// Flag to know if list was already fired
					fired,
					// Flag to know if list is currently firing
					firing,
					// First callback to fire (used internally by add and fireWith)
					firingStart,
					// End of the loop when firing
					firingLength,
					// Index of currently firing callback (modified by remove if needed)
					firingIndex,
					// Actual callback list
					list = [],
					// Stack of fire calls for repeatable lists
					stack = !options.once && [],
					// Fire callbacks
					fire = function (data) {
						memory = options.memory && data;
						fired = true;
						firingIndex = firingStart || 0;
						firingStart = 0;
						firingLength = list.length;
						firing = true;
						for (; list && firingIndex < firingLength; firingIndex++) {
							if (list[firingIndex].apply(data[0], data[1]) === false && options.stopOnFalse) {
								memory = false; // To prevent further calls using add
								break;
							}
						}
						firing = false;
						if (list) {
							if (stack) {
								if (stack.length) {
									fire(stack.shift());
								}
							} else if (memory) {
								list = [];
							} else {
								self.disable();
							}
						}
					},
					// Actual Callbacks object
					self = {
						// Add a callback or a collection of callbacks to the list
						add: function () {
							if (list) {
								// First, we save the current length
								var start = list.length;
								(function add(args) {
									JQXLite.each(args, function (_, arg) {
										var type = JQXLite.type(arg);
										if (type === "function") {
											if (!options.unique || !self.has(arg)) {
												list.push(arg);
											}
										} else if (arg && arg.length && type !== "string") {
											// Inspect recursively
											add(arg);
										}
									});
								})(arguments);
								// Do we need to add the callbacks to the
								// current firing batch?
								if (firing) {
									firingLength = list.length;
									// With memory, if we're not firing then
									// we should call right away
								} else if (memory) {
									firingStart = start;
									fire(memory);
								}
							}
							return this;
						},
						// Remove a callback from the list
						remove: function () {
							if (list) {
								JQXLite.each(arguments, function (_, arg) {
									var index;
									while ((index = JQXLite.inArray(arg, list, index)) > -1) {
										list.splice(index, 1);
										// Handle firing indexes
										if (firing) {
											if (index <= firingLength) {
												firingLength--;
											}
											if (index <= firingIndex) {
												firingIndex--;
											}
										}
									}
								});
							}
							return this;
						},
						// Control if a given callback is in the list
						has: function (fn) {
							return JQXLite.inArray(fn, list) > -1;
						},
						// Remove all callbacks from the list
						empty: function () {
							list = [];
							return this;
						},
						// Have the list do nothing anymore
						disable: function () {
							list = stack = memory = undefined;
							return this;
						},
						// Is it disabled?
						disabled: function () {
							return !list;
						},
						// Lock the list in its current state
						lock: function () {
							stack = undefined;
							if (!memory) {
								self.disable();
							}
							return this;
						},
						// Is it locked?
						locked: function () {
							return !stack;
						},
						// Call all callbacks with the given context and arguments
						fireWith: function (context, args) {
							args = args || [];
							args = [context, args.slice ? args.slice() : args];
							if (list && (!fired || stack)) {
								if (firing) {
									stack.push(args);
								} else {
									fire(args);
								}
							}
							return this;
						},
						// Call all the callbacks with the given arguments
						fire: function () {
							self.fireWith(this, arguments);
							return this;
						},
						// To know if the callbacks have already been called at least once
						fired: function () {
							return !!fired;
						}
					};

				return self;
			};
			JQXLite.extend({

				Deferred: function (func) {
					var tuples = [
						// action, add listener, listener list, final state
						["resolve", "done", JQXLite.Callbacks("once memory"), "resolved"],
						["reject", "fail", JQXLite.Callbacks("once memory"), "rejected"],
						["notify", "progress", JQXLite.Callbacks("memory")]
					],
						state = "pending",
						promise = {
							state: function () {
								return state;
							},
							always: function () {
								deferred.done(arguments).fail(arguments);
								return this;
							},
							then: function ( /* fnDone, fnFail, fnProgress */) {
								var fns = arguments;
								return JQXLite.Deferred(function (newDefer) {
									JQXLite.each(tuples, function (i, tuple) {
										var action = tuple[0],
											fn = fns[i];
										// deferred[ done | fail | progress ] for forwarding actions to newDefer
										deferred[tuple[1]](JQXLite.isFunction(fn) ?
											function () {
												var returned = fn.apply(this, arguments);
												if (returned && JQXLite.isFunction(returned.promise)) {
													returned.promise()
														.done(newDefer.resolve)
														.fail(newDefer.reject)
														.progress(newDefer.notify);
												} else {
													newDefer[action + "With"](this === deferred ? newDefer : this, [returned]);
												}
											} :
											newDefer[action]
										);
									});
									fns = null;
								}).promise();
							},
							// Get a promise for this deferred
							// If obj is provided, the promise aspect is added to the object
							promise: function (obj) {
								return obj != null ? JQXLite.extend(obj, promise) : promise;
							}
						},
						deferred = {};

					// Keep pipe for back-compat
					promise.pipe = promise.then;

					// Add list-specific methods
					JQXLite.each(tuples, function (i, tuple) {
						var list = tuple[2],
							stateString = tuple[3];

						// promise[ done | fail | progress ] = list.add
						promise[tuple[1]] = list.add;

						// Handle state
						if (stateString) {
							list.add(function () {
								// state = [ resolved | rejected ]
								state = stateString;

								// [ reject_list | resolve_list ].disable; progress_list.lock
							}, tuples[i ^ 1][2].disable, tuples[2][2].lock);
						}

						// deferred[ resolve | reject | notify ] = list.fire
						deferred[tuple[0]] = list.fire;
						deferred[tuple[0] + "With"] = list.fireWith;
					});

					// Make the deferred a promise
					promise.promise(deferred);

					// Call given func if any
					if (func) {
						func.call(deferred, deferred);
					}

					// All done!
					return deferred;
				},

				// Deferred helper
				when: function (subordinate /* , ..., subordinateN */) {
					var i = 0,
						resolveValues = core_slice.call(arguments),
						length = resolveValues.length,

						// the count of uncompleted subordinates
						remaining = length !== 1 || (subordinate && JQXLite.isFunction(subordinate.promise)) ? length : 0,

						// the master Deferred. If resolveValues consist of only a single Deferred, just use that.
						deferred = remaining === 1 ? subordinate : JQXLite.Deferred(),

						// Update function for both resolve and progress values
						updateFunc = function (i, contexts, values) {
							return function (value) {
								contexts[i] = this;
								values[i] = arguments.length > 1 ? core_slice.call(arguments) : value;
								if (values === progressValues) {
									deferred.notifyWith(contexts, values);
								} else if (!(--remaining)) {
									deferred.resolveWith(contexts, values);
								}
							};
						},

						progressValues, progressContexts, resolveContexts;

					// add listeners to Deferred subordinates; treat others as resolved
					if (length > 1) {
						progressValues = new Array(length);
						progressContexts = new Array(length);
						resolveContexts = new Array(length);
						for (; i < length; i++) {
							if (resolveValues[i] && JQXLite.isFunction(resolveValues[i].promise)) {
								resolveValues[i].promise()
									.done(updateFunc(i, resolveContexts, resolveValues))
									.fail(deferred.reject)
									.progress(updateFunc(i, progressContexts, progressValues));
							} else {
								--remaining;
							}
						}
					}

					// if we're not waiting on anything, resolve the master
					if (!remaining) {
						deferred.resolveWith(resolveContexts, resolveValues);
					}

					return deferred.promise();
				}
			});
			JQXLite.support = (function () {

				var support,
					all,
					a,
					select,
					opt,
					input,
					fragment,
					eventName,
					i,
					isSupported,
					clickFn,
					div = document.createElement("div");

				// Setup
				div.setAttribute("className", "t");
				div.innerHTML = "  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>";

				// Support tests won't run in some limited or non-browser environments
				all = div.getElementsByTagName("*");
				a = div.getElementsByTagName("a")[0];
				if (!all || !a || !all.length) {
					return {};
				}

				// First batch of tests
				select = document.createElement("select");
				opt = select.appendChild(document.createElement("option"));
				input = div.getElementsByTagName("input")[0];

				a.style.cssText = "top:1px;float:left;opacity:.5";
				support = {
					// IE strips leading whitespace when .innerHTML is used
					leadingWhitespace: (div.firstChild.nodeType === 3),

					// Make sure that tbody elements aren't automatically inserted
					// IE will insert them into empty tables
					tbody: !div.getElementsByTagName("tbody").length,

					// Make sure that link elements get serialized correctly by innerHTML
					// This requires a wrapper element in IE
					htmlSerialize: !!div.getElementsByTagName("link").length,

					// Get the style information from getAttribute
					// (IE uses .cssText instead)
					style: /top/.test(a.getAttribute("style")),

					// Make sure that URLs aren't manipulated
					// (IE normalizes it by default)
					hrefNormalized: (a.getAttribute("href") === "/a"),

					// Make sure that element opacity exists
					// (IE uses filter instead)
					// Use a regex to work around a WebKit issue. See #5145
					opacity: /^0.5/.test(a.style.opacity),

					// Verify style float existence
					// (IE uses styleFloat instead of cssFloat)
					cssFloat: !!a.style.cssFloat,

					// Make sure that if no value is specified for a checkbox
					// that it defaults to "on".
					// (WebKit defaults to "" instead)
					checkOn: (input.value === "on"),

					// Make sure that a selected-by-default option has a working selected property.
					// (WebKit defaults to false instead of true, IE too, if it's in an optgroup)
					optSelected: opt.selected,

					// Test setAttribute on camelCase class. If it works, we need attrFixes when doing get/setAttribute (ie6/7)
					getSetAttribute: div.className !== "t",

					// Tests for enctype support on a form (#6743)
					enctype: !!document.createElement("form").enctype,

					// Makes sure cloning an html5 element does not cause problems
					// Where outerHTML is undefined, this still works
					html5Clone: document.createElement("nav").cloneNode(true).outerHTML !== "<:nav></:nav>",

					// JQXLite.support.boxModel DEPRECATED in 1.8 since we don't support Quirks Mode
					boxModel: (document.compatMode === "CSS1Compat"),

					// Will be defined later
					submitBubbles: true,
					changeBubbles: true,
					focusinBubbles: false,
					deleteExpando: true,
					noCloneEvent: true,
					inlineBlockNeedsLayout: false,
					shrinkWrapBlocks: false,
					reliableMarginRight: true,
					boxSizingReliable: true,
					pixelPosition: false
				};

				// Make sure checked status is properly cloned
				input.checked = true;
				support.noCloneChecked = input.cloneNode(true).checked;

				// Make sure that the options inside disabled selects aren't marked as disabled
				// (WebKit marks them as disabled)
				select.disabled = true;
				support.optDisabled = !opt.disabled;

				// Test to see if it's possible to delete an expando from an element
				// Fails in Internet Explorer
				try {
					delete div.test;
				} catch (e) {
					support.deleteExpando = false;
				}

				if (!div.addEventListener && div.attachEvent && div.fireEvent) {
					div.attachEvent("onclick", clickFn = function () {
						// Cloning a node shouldn't copy over any
						// bound event handlers (IE does this)
						support.noCloneEvent = false;
					});
					div.cloneNode(true).fireEvent("onclick");
					div.detachEvent("onclick", clickFn);
				}

				// Check if a radio maintains its value
				// after being appended to the DOM
				input = document.createElement("input");
				input.value = "t";
				input.setAttribute("type", "radio");
				support.radioValue = input.value === "t";

				input.setAttribute("checked", "checked");

				// #11217 - WebKit loses check when the name is after the checked attribute
				input.setAttribute("name", "t");

				div.appendChild(input);
				fragment = document.createDocumentFragment();
				fragment.appendChild(div.lastChild);

				// WebKit doesn't clone checked state correctly in fragments
				support.checkClone = fragment.cloneNode(true).cloneNode(true).lastChild.checked;

				// Check if a disconnected checkbox will retain its checked
				// value of true after appended to the DOM (IE6/7)
				support.appendChecked = input.checked;

				fragment.removeChild(input);
				fragment.appendChild(div);

				// Technique from Juriy Zaytsev
				// http://perfectionkills.com/detecting-event-support-without-browser-sniffing/
				// We only care about the case where non-standard event systems
				// are used, namely in IE. Short-circuiting here helps us to
				// avoid an eval call (in setAttribute) which can cause CSP
				// to go haywire. See: https://developer.mozilla.org/en/Security/CSP
				if (div.attachEvent) {
					for (i in {
						submit: true,
						change: true,
						focusin: true
					}) {
						eventName = "on" + i;
						isSupported = (eventName in div);
						if (!isSupported) {
							div.setAttribute(eventName, "return;");
							isSupported = (typeof div[eventName] === "function");
						}
						support[i + "Bubbles"] = isSupported;
					}
				}

				// Run tests that need a body at doc ready
				JQXLite(function () {
					var container, div, tds, marginDiv,
						divReset = "padding:0;margin:0;border:0;display:block;overflow:hidden;",
						body = document.getElementsByTagName("body")[0];

					if (!body) {
						// Return for frameset docs that don't have a body
						return;
					}

					container = document.createElement("div");
					container.style.cssText = "visibility:hidden;border:0;width:0;height:0;position:static;top:0;margin-top:1px";
					body.insertBefore(container, body.firstChild);

					// Construct the test element
					div = document.createElement("div");
					container.appendChild(div);

					// Check if table cells still have offsetWidth/Height when they are set
					// to display:none and there are still other visible table cells in a
					// table row; if so, offsetWidth/Height are not reliable for use when
					// determining if an element has been hidden directly using
					// display:none (it is still safe to use offsets if a parent element is
					// hidden; don safety goggles and see bug #4512 for more information).
					// (only IE 8 fails this test)
					div.innerHTML = "<table><tr><td></td><td>t</td></tr></table>";
					tds = div.getElementsByTagName("td");
					tds[0].style.cssText = "padding:0;margin:0;border:0;display:none";
					isSupported = (tds[0].offsetHeight === 0);

					tds[0].style.display = "";
					tds[1].style.display = "none";

					// Check if empty table cells still have offsetWidth/Height
					// (IE <= 8 fail this test)
					support.reliableHiddenOffsets = isSupported && (tds[0].offsetHeight === 0);

					// Check box-sizing and margin behavior
					div.innerHTML = "";
					div.style.cssText = "box-sizing:border-box;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;padding:1px;border:1px;display:block;width:4px;margin-top:1%;position:absolute;top:1%;";
					support.boxSizing = (div.offsetWidth === 4);
					support.doesNotIncludeMarginInBodyOffset = (body.offsetTop !== 1);

					// NOTE: To any future maintainer, we've window.getComputedStyle
					// because jsdom on node.js will break without it.
					if (window.getComputedStyle) {
						support.pixelPosition = (window.getComputedStyle(div, null) || {}).top !== "1%";
						support.boxSizingReliable = (window.getComputedStyle(div, null) || { width: "4px" }).width === "4px";

						// Check if div with explicit width and no margin-right incorrectly
						// gets computed margin-right based on width of container. For more
						// info see bug #3333
						// Fails in WebKit before Feb 2011 nightlies
						// WebKit Bug 13343 - getComputedStyle returns wrong value for margin-right
						marginDiv = document.createElement("div");
						marginDiv.style.cssText = div.style.cssText = divReset;
						marginDiv.style.marginRight = marginDiv.style.width = "0";
						div.style.width = "1px";
						div.appendChild(marginDiv);
						support.reliableMarginRight =
							!parseFloat((window.getComputedStyle(marginDiv, null) || {}).marginRight);
					}

					if (typeof div.style.zoom !== "undefined") {
						// Check if natively block-level elements act like inline-block
						// elements when setting their display to 'inline' and giving
						// them layout
						// (IE < 8 does this)
						div.innerHTML = "";
						div.style.cssText = divReset + "width:1px;padding:1px;display:inline;zoom:1";
						support.inlineBlockNeedsLayout = (div.offsetWidth === 3);

						// Check if elements with layout shrink-wrap their children
						// (IE 6 does this)
						div.style.display = "block";
						div.style.overflow = "visible";
						div.innerHTML = "<div></div>";
						div.firstChild.style.width = "5px";
						support.shrinkWrapBlocks = (div.offsetWidth !== 3);

						container.style.zoom = 1;
					}

					// Null elements to avoid leaks in IE
					body.removeChild(container);
					container = div = tds = marginDiv = null;
				});

				// Null elements to avoid leaks in IE
				fragment.removeChild(div);
				all = a = select = opt = input = fragment = div = null;

				return support;
			})();
			var rbrace = /(?:\{[\s\S]*\}|\[[\s\S]*\])$/,
				rmultiDash = /([A-Z])/g;

			JQXLite.extend({
				cache: {},

				deletedIds: [],

				// Remove at next major release (1.9/2.0)
				uuid: 0,

				// Unique for each copy of JQXLite on the page
				// Non-digits removed to match rinlinejQuery
				expando: "JQXLite" + (JQXLite.fn.jqx + Math.random()).replace(/\D/g, ""),

				// The following elements throw uncatchable exceptions if you
				// attempt to add expando properties to them.
				noData: {
					"embed": true,
					// Ban all objects except for Flash (which handle expandos)
					"object": "clsid:D27CDB6E-AE6D-11cf-96B8-444553540000",
					"applet": true
				},

				hasData: function (elem) {
					elem = elem.nodeType ? JQXLite.cache[elem[JQXLite.expando]] : elem[JQXLite.expando];
					return !!elem && !isEmptyDataObject(elem);
				},

				data: function (elem, name, data, pvt /* Internal Use Only */) {
					if (!JQXLite.acceptData(elem)) {
						return;
					}

					var thisCache, ret,
						internalKey = JQXLite.expando,
						getByName = typeof name === "string",

						// We have to handle DOM nodes and JS objects differently because IE6-7
						// can't GC object references properly across the DOM-JS boundary
						isNode = elem.nodeType,

						// Only DOM nodes need the global JQXLite cache; JS object data is
						// attached directly to the object so GC can occur automatically
						cache = isNode ? JQXLite.cache : elem,

						// Only defining an ID for JS objects if its cache already exists allows
						// the code to shortcut on the same path as a DOM node with no cache
						id = isNode ? elem[internalKey] : elem[internalKey] && internalKey;

					// Avoid doing any more work than we need to when trying to get data on an
					// object that has no data at all
					if ((!id || !cache[id] || (!pvt && !cache[id].data)) && getByName && data === undefined) {
						return;
					}

					if (!id) {
						// Only DOM nodes need a new unique ID for each element since their data
						// ends up in the global cache
						if (isNode) {
							elem[internalKey] = id = JQXLite.deletedIds.pop() || JQXLite.guid++;
						} else {
							id = internalKey;
						}
					}

					if (!cache[id]) {
						cache[id] = {};

						// Avoids exposing JQXLite metadata on plain JS objects when the object
						// is serialized using JSON.stringify
						if (!isNode) {
							cache[id].toJSON = JQXLite.noop;
						}
					}

					// An object can be passed to JQXLite.data instead of a key/value pair; this gets
					// shallow copied over onto the existing cache
					if (typeof name === "object" || typeof name === "function") {
						if (pvt) {
							cache[id] = JQXLite.extend(cache[id], name);
						} else {
							cache[id].data = JQXLite.extend(cache[id].data, name);
						}
					}

					thisCache = cache[id];

					// JQXLite data() is stored in a separate object inside the object's internal data
					// cache in order to avoid key collisions between internal data and user-defined
					// data.
					if (!pvt) {
						if (!thisCache.data) {
							thisCache.data = {};
						}

						thisCache = thisCache.data;
					}

					if (data !== undefined) {
						thisCache[JQXLite.camelCase(name)] = data;
					}

					// Check for both converted-to-camel and non-converted data property names
					// If a data property was specified
					if (getByName) {

						// First Try to find as-is property data
						ret = thisCache[name];

						// Test for null|undefined property data
						if (ret == null) {

							// Try to find the camelCased property
							ret = thisCache[JQXLite.camelCase(name)];
						}
					} else {
						ret = thisCache;
					}

					return ret;
				},

				removeData: function (elem, name, pvt /* Internal Use Only */) {
					if (!JQXLite.acceptData(elem)) {
						return;
					}

					var thisCache, i, l,

						isNode = elem.nodeType,

						// See JQXLite.data for more information
						cache = isNode ? JQXLite.cache : elem,
						id = isNode ? elem[JQXLite.expando] : JQXLite.expando;

					// If there is already no cache entry for this object, there is no
					// purpose in continuing
					if (!cache[id]) {
						return;
					}

					if (name) {

						thisCache = pvt ? cache[id] : cache[id].data;

						if (thisCache) {

							// Support array or space separated string names for data keys
							if (!JQXLite.isArray(name)) {

								// try the string as a key before any manipulation
								if (name in thisCache) {
									name = [name];
								} else {

									// split the camel cased version by spaces unless a key with the spaces exists
									name = JQXLite.camelCase(name);
									if (name in thisCache) {
										name = [name];
									} else {
										name = name.split(" ");
									}
								}
							}

							for (i = 0, l = name.length; i < l; i++) {
								delete thisCache[name[i]];
							}

							// If there is no data left in the cache, we want to continue
							// and let the cache object itself get destroyed
							if (!(pvt ? isEmptyDataObject : JQXLite.isEmptyObject)(thisCache)) {
								return;
							}
						}
					}

					// See JQXLite.data for more information
					if (!pvt) {
						delete cache[id].data;

						// Don't destroy the parent cache unless the internal data object
						// had been the only thing left in it
						if (!isEmptyDataObject(cache[id])) {
							return;
						}
					}

					// Destroy the cache
					if (isNode) {
						JQXLite.cleanData([elem], true);

						// Use delete when supported for expandos or `cache` is not a window per isWindow (#10080)
					} else if (JQXLite.support.deleteExpando || cache != cache.window) {
						delete cache[id];

						// When all else fails, null
					} else {
						cache[id] = null;
					}
				},

				// For internal use only.
				_data: function (elem, name, data) {
					return JQXLite.data(elem, name, data, true);
				},

				// A method for determining if a DOM node can handle the data expando
				acceptData: function (elem) {
					var noData = elem.nodeName && JQXLite.noData[elem.nodeName.toLowerCase()];

					// nodes accept data unless otherwise specified; rejection can be conditional
					return !noData || noData !== true && elem.getAttribute("classid") === noData;
				}
			});

			JQXLite.fn.extend({
				data: function (key, value) {
					var parts, part, attr, name, l,
						elem = this[0],
						i = 0,
						data = null;

					// Gets all values
					if (key === undefined) {
						if (this.length) {
							data = JQXLite.data(elem);

							if (elem.nodeType === 1 && !JQXLite._data(elem, "parsedAttrs")) {
								attr = elem.attributes;
								for (l = attr.length; i < l; i++) {
									name = attr[i].name;

									if (!name.indexOf("data-")) {
										name = JQXLite.camelCase(name.substring(5));

										dataAttr(elem, name, data[name]);
									}
								}
								JQXLite._data(elem, "parsedAttrs", true);
							}
						}

						return data;
					}

					// Sets multiple values
					if (typeof key === "object") {
						return this.each(function () {
							JQXLite.data(this, key);
						});
					}

					parts = key.split(".", 2);
					parts[1] = parts[1] ? "." + parts[1] : "";
					part = parts[1] + "!";

					return JQXLite.access(this, function (value) {

						if (value === undefined) {
							data = this.triggerHandler("getData" + part, [parts[0]]);

							// Try to fetch any internally stored data first
							if (data === undefined && elem) {
								data = JQXLite.data(elem, key);
								data = dataAttr(elem, key, data);
							}

							return data === undefined && parts[1] ?
								this.data(parts[0]) :
								data;
						}

						parts[1] = value;
						this.each(function () {
							var self = JQXLite(this);

							self.triggerHandler("setData" + part, parts);
							JQXLite.data(this, key, value);
							self.triggerHandler("changeData" + part, parts);
						});
					}, null, value, arguments.length > 1, null, false);
				},

				removeData: function (key) {
					return this.each(function () {
						JQXLite.removeData(this, key);
					});
				}
			});

			function dataAttr(elem, key, data) {
				// If nothing was found internally, try to fetch any
				// data from the HTML5 data-* attribute
				if (data === undefined && elem.nodeType === 1) {

					var name = "data-" + key.replace(rmultiDash, "-$1").toLowerCase();

					data = elem.getAttribute(name);

					if (typeof data === "string") {
						try {
							data = data === "true" ? true :
								data === "false" ? false :
									data === "null" ? null :
										// Only convert to a number if it doesn't change the string
										+data + "" === data ? +data :
											rbrace.test(data) ? JQXLite.parseJSON(data) :
												data;
						} catch (e) { }

						// Make sure we set the data so it isn't changed later
						JQXLite.data(elem, key, data);

					} else {
						data = undefined;
					}
				}

				return data;
			}

			// checks a cache object for emptiness
			function isEmptyDataObject(obj) {
				var name;
				for (name in obj) {

					// if the public data object is empty, the private is still empty
					if (name === "data" && JQXLite.isEmptyObject(obj[name])) {
						continue;
					}
					if (name !== "toJSON") {
						return false;
					}
				}

				return true;
			}
			JQXLite.extend({
				queue: function (elem, type, data) {
					var queue;

					if (elem) {
						type = (type || "fx") + "queue";
						queue = JQXLite._data(elem, type);

						// Speed up dequeue by getting out quickly if this is just a lookup
						if (data) {
							if (!queue || JQXLite.isArray(data)) {
								queue = JQXLite._data(elem, type, JQXLite.makeArray(data));
							} else {
								queue.push(data);
							}
						}
						return queue || [];
					}
				},

				dequeue: function (elem, type) {
					type = type || "fx";

					var queue = JQXLite.queue(elem, type),
						startLength = queue.length,
						fn = queue.shift(),
						hooks = JQXLite._queueHooks(elem, type),
						next = function () {
							JQXLite.dequeue(elem, type);
						};

					// If the fx queue is dequeued, always remove the progress sentinel
					if (fn === "inprogress") {
						fn = queue.shift();
						startLength--;
					}

					if (fn) {

						// Add a progress sentinel to prevent the fx queue from being
						// automatically dequeued
						if (type === "fx") {
							queue.unshift("inprogress");
						}

						// clear up the last queue stop function
						delete hooks.stop;
						fn.call(elem, next, hooks);
					}

					if (!startLength && hooks) {
						hooks.empty.fire();
					}
				},

				// not intended for public consumption - generates a queueHooks object, or returns the current one
				_queueHooks: function (elem, type) {
					var key = type + "queueHooks";
					return JQXLite._data(elem, key) || JQXLite._data(elem, key, {
						empty: JQXLite.Callbacks("once memory").add(function () {
							JQXLite.removeData(elem, type + "queue", true);
							JQXLite.removeData(elem, key, true);
						})
					});
				}
			});

			JQXLite.fn.extend({
				queue: function (type, data) {
					var setter = 2;

					if (typeof type !== "string") {
						data = type;
						type = "fx";
						setter--;
					}

					if (arguments.length < setter) {
						return JQXLite.queue(this[0], type);
					}

					return data === undefined ?
						this :
						this.each(function () {
							var queue = JQXLite.queue(this, type, data);

							// ensure a hooks for this queue
							JQXLite._queueHooks(this, type);

							if (type === "fx" && queue[0] !== "inprogress") {
								JQXLite.dequeue(this, type);
							}
						});
				},
				dequeue: function (type) {
					return this.each(function () {
						JQXLite.dequeue(this, type);
					});
				},
				// Based off of the plugin by Clint Helfers, with permission.
				// http://blindsignals.com/index.php/2009/07/jqx-delay/
				delay: function (time, type) {
					time = JQXLite.fx ? JQXLite.fx.speeds[time] || time : time;
					type = type || "fx";

					return this.queue(type, function (next, hooks) {
						var timeout = setTimeout(next, time);
						hooks.stop = function () {
							clearTimeout(timeout);
						};
					});
				},
				clearQueue: function (type) {
					return this.queue(type || "fx", []);
				},
				// Get a promise resolved when queues of a certain type
				// are emptied (fx is the type by default)
				promise: function (type, obj) {
					var tmp,
						count = 1,
						defer = JQXLite.Deferred(),
						elements = this,
						i = this.length,
						resolve = function () {
							if (!(--count)) {
								defer.resolveWith(elements, [elements]);
							}
						};

					if (typeof type !== "string") {
						obj = type;
						type = undefined;
					}
					type = type || "fx";

					while (i--) {
						tmp = JQXLite._data(elements[i], type + "queueHooks");
						if (tmp && tmp.empty) {
							count++;
							tmp.empty.add(resolve);
						}
					}
					resolve();
					return defer.promise(obj);
				}
			});
			var nodeHook, boolHook, fixSpecified,
				rclass = /[\t\r\n]/g,
				rreturn = /\r/g,
				rtype = /^(?:button|input)$/i,
				rfocusable = /^(?:button|input|object|select|textarea)$/i,
				rclickable = /^a(?:rea|)$/i,
				rboolean = /^(?:autofocus|autoplay|async|checked|controls|defer|disabled|hidden|loop|multiple|open|readonly|required|scoped|selected)$/i,
				getSetAttribute = JQXLite.support.getSetAttribute;

			JQXLite.fn.extend({
				attr: function (name, value) {
					return JQXLite.access(this, JQXLite.attr, name, value, arguments.length > 1);
				},

				removeAttr: function (name) {
					return this.each(function () {
						JQXLite.removeAttr(this, name);
					});
				},

				prop: function (name, value) {
					return JQXLite.access(this, JQXLite.prop, name, value, arguments.length > 1);
				},

				removeProp: function (name) {
					name = JQXLite.propFix[name] || name;
					return this.each(function () {
						// try/catch handles cases where IE balks (such as removing a property on window)
						try {
							this[name] = undefined;
							delete this[name];
						} catch (e) { }
					});
				},

				addClass: function (value) {
					var classNames, i, l, elem,
						setClass, c, cl;

					if (JQXLite.isFunction(value)) {
						return this.each(function (j) {
							JQXLite(this).addClass(value.call(this, j, this.className));
						});
					}

					if (value && typeof value === "string") {
						classNames = value.split(core_rspace);

						for (i = 0, l = this.length; i < l; i++) {
							elem = this[i];

							if (elem.nodeType === 1) {
								if (!elem.className && classNames.length === 1) {
									elem.className = value;

								} else {
									setClass = " " + elem.className + " ";

									for (c = 0, cl = classNames.length; c < cl; c++) {
										if (setClass.indexOf(" " + classNames[c] + " ") < 0) {
											setClass += classNames[c] + " ";
										}
									}
									elem.className = JQXLite.trim(setClass);
								}
							}
						}
					}

					return this;
				},

				removeClass: function (value) {
					var removes, className, elem, c, cl, i, l;

					if (JQXLite.isFunction(value)) {
						return this.each(function (j) {
							JQXLite(this).removeClass(value.call(this, j, this.className));
						});
					}
					if ((value && typeof value === "string") || value === undefined) {
						removes = (value || "").split(core_rspace);

						for (i = 0, l = this.length; i < l; i++) {
							elem = this[i];
							if (elem.nodeType === 1 && elem.className) {

								className = (" " + elem.className + " ").replace(rclass, " ");

								// loop over each item in the removal list
								for (c = 0, cl = removes.length; c < cl; c++) {
									// Remove until there is nothing to remove,
									while (className.indexOf(" " + removes[c] + " ") >= 0) {
										className = className.replace(" " + removes[c] + " ", " ");
									}
								}
								elem.className = value ? JQXLite.trim(className) : "";
							}
						}
					}

					return this;
				},

				toggleClass: function (value, stateVal) {
					var type = typeof value,
						isBool = typeof stateVal === "boolean";

					if (JQXLite.isFunction(value)) {
						return this.each(function (i) {
							JQXLite(this).toggleClass(value.call(this, i, this.className, stateVal), stateVal);
						});
					}

					return this.each(function () {
						if (type === "string") {
							// toggle individual class names
							var className,
								i = 0,
								self = JQXLite(this),
								state = stateVal,
								classNames = value.split(core_rspace);

							while ((className = classNames[i++])) {
								// check each className given, space separated list
								state = isBool ? state : !self.hasClass(className);
								self[state ? "addClass" : "removeClass"](className);
							}

						} else if (type === "undefined" || type === "boolean") {
							if (this.className) {
								// store className if set
								JQXLite._data(this, "__className__", this.className);
							}

							// toggle whole className
							this.className = this.className || value === false ? "" : JQXLite._data(this, "__className__") || "";
						}
					});
				},

				hasClass: function (selector) {
					var className = " " + selector + " ",
						i = 0,
						l = this.length;
					for (; i < l; i++) {
						if (this[i].nodeType === 1 && (" " + this[i].className + " ").replace(rclass, " ").indexOf(className) >= 0) {
							return true;
						}
					}

					return false;
				},

				val: function (value) {
					var hooks, ret, isFunction,
						elem = this[0];

					if (!arguments.length) {
						if (elem) {
							hooks = JQXLite.valHooks[elem.type] || JQXLite.valHooks[elem.nodeName.toLowerCase()];

							if (hooks && "get" in hooks && (ret = hooks.get(elem, "value")) !== undefined) {
								return ret;
							}

							ret = elem.value;

							return typeof ret === "string" ?
								// handle most common string cases
								ret.replace(rreturn, "") :
								// handle cases where value is null/undef or number
								ret == null ? "" : ret;
						}

						return;
					}

					isFunction = JQXLite.isFunction(value);

					return this.each(function (i) {
						var val,
							self = JQXLite(this);

						if (this.nodeType !== 1) {
							return;
						}

						if (isFunction) {
							val = value.call(this, i, self.val());
						} else {
							val = value;
						}

						// Treat null/undefined as ""; convert numbers to string
						if (val == null) {
							val = "";
						} else if (typeof val === "number") {
							val += "";
						} else if (JQXLite.isArray(val)) {
							val = JQXLite.map(val, function (value) {
								return value == null ? "" : value + "";
							});
						}

						hooks = JQXLite.valHooks[this.type] || JQXLite.valHooks[this.nodeName.toLowerCase()];

						// If set returns undefined, fall back to normal setting
						if (!hooks || !("set" in hooks) || hooks.set(this, val, "value") === undefined) {
							this.value = val;
						}
					});
				}
			});

			JQXLite.extend({
				valHooks: {
					option: {
						get: function (elem) {
							// attributes.value is undefined in Blackberry 4.7 but
							// uses .value. See #6932
							var val = elem.attributes.value;
							return !val || val.specified ? elem.value : elem.text;
						}
					},
					select: {
						get: function (elem) {
							var value, option,
								options = elem.options,
								index = elem.selectedIndex,
								one = elem.type === "select-one" || index < 0,
								values = one ? null : [],
								max = one ? index + 1 : options.length,
								i = index < 0 ?
									max :
									one ? index : 0;

							// Loop through all the selected options
							for (; i < max; i++) {
								option = options[i];

								// oldIE doesn't update selected after form reset (#2551)
								if ((option.selected || i === index) &&
									// Don't return options that are disabled or in a disabled optgroup
									(JQXLite.support.optDisabled ? !option.disabled : option.getAttribute("disabled") === null) &&
									(!option.parentNode.disabled || !JQXLite.nodeName(option.parentNode, "optgroup"))) {

									// Get the specific value for the option
									value = JQXLite(option).val();

									// We don't need an array for one selects
									if (one) {
										return value;
									}

									// Multi-Selects return an array
									values.push(value);
								}
							}

							return values;
						},

						set: function (elem, value) {
							var values = JQXLite.makeArray(value);

							JQXLite(elem).find("option").each(function () {
								this.selected = JQXLite.inArray(JQXLite(this).val(), values) >= 0;
							});

							if (!values.length) {
								elem.selectedIndex = -1;
							}
							return values;
						}
					}
				},

				// Unused in 1.8, left in so attrFn-stabbers won't die; remove in 1.9
				attrFn: {},

				attr: function (elem, name, value, pass) {
					var ret, hooks, notxml,
						nType = elem.nodeType;

					// don't get/set attributes on text, comment and attribute nodes
					if (!elem || nType === 3 || nType === 8 || nType === 2) {
						return;
					}

					if (pass && JQXLite.isFunction(JQXLite.fn[name])) {
						return JQXLite(elem)[name](value);
					}

					// Fallback to prop when attributes are not supported
					if (typeof elem.getAttribute === "undefined") {
						return JQXLite.prop(elem, name, value);
					}

					notxml = nType !== 1 || !JQXLite.isXMLDoc(elem);

					// All attributes are lowercase
					// Grab necessary hook if one is defined
					if (notxml) {
						name = name.toLowerCase();
						hooks = JQXLite.attrHooks[name] || (rboolean.test(name) ? boolHook : nodeHook);
					}

					if (value !== undefined) {

						if (value === null) {
							JQXLite.removeAttr(elem, name);
							return;

						} else if (hooks && "set" in hooks && notxml && (ret = hooks.set(elem, value, name)) !== undefined) {
							return ret;

						} else {
							elem.setAttribute(name, value + "");
							return value;
						}

					} else if (hooks && "get" in hooks && notxml && (ret = hooks.get(elem, name)) !== null) {
						return ret;

					} else {

						ret = elem.getAttribute(name);

						// Non-existent attributes return null, we normalize to undefined
						return ret === null ?
							undefined :
							ret;
					}
				},

				removeAttr: function (elem, value) {
					var propName, attrNames, name, isBool,
						i = 0;

					if (value && elem.nodeType === 1) {

						attrNames = value.split(core_rspace);

						for (; i < attrNames.length; i++) {
							name = attrNames[i];

							if (name) {
								propName = JQXLite.propFix[name] || name;
								isBool = rboolean.test(name);

								// See #9699 for explanation of this approach (setting first, then removal)
								// Do not do this for boolean attributes (see #10870)
								if (!isBool) {
									JQXLite.attr(elem, name, "");
								}
								elem.removeAttribute(getSetAttribute ? name : propName);

								// Set corresponding property to false for boolean attributes
								if (isBool && propName in elem) {
									elem[propName] = false;
								}
							}
						}
					}
				},

				attrHooks: {
					type: {
						set: function (elem, value) {
							// We can't allow the type property to be changed (since it causes problems in IE)
							if (rtype.test(elem.nodeName) && elem.parentNode) {
								JQXLite.error("type property can't be changed");
							} else if (!JQXLite.support.radioValue && value === "radio" && JQXLite.nodeName(elem, "input")) {
								// Setting the type on a radio button after the value resets the value in IE6-9
								// Reset value to it's default in case type is set after value
								// This is for element creation
								var val = elem.value;
								elem.setAttribute("type", value);
								if (val) {
									elem.value = val;
								}
								return value;
							}
						}
					},
					// Use the value property for back compat
					// Use the nodeHook for button elements in IE6/7 (#1954)
					value: {
						get: function (elem, name) {
							if (nodeHook && JQXLite.nodeName(elem, "button")) {
								return nodeHook.get(elem, name);
							}
							return name in elem ?
								elem.value :
								null;
						},
						set: function (elem, value, name) {
							if (nodeHook && JQXLite.nodeName(elem, "button")) {
								return nodeHook.set(elem, value, name);
							}
							// Does not return so that setAttribute is also used
							elem.value = value;
						}
					}
				},

				propFix: {
					tabindex: "tabIndex",
					readonly: "readOnly",
					"for": "htmlFor",
					"class": "className",
					maxlength: "maxLength",
					cellspacing: "cellSpacing",
					cellpadding: "cellPadding",
					rowspan: "rowSpan",
					colspan: "colSpan",
					usemap: "useMap",
					frameborder: "frameBorder",
					contenteditable: "contentEditable"
				},

				prop: function (elem, name, value) {
					var ret, hooks, notxml,
						nType = elem.nodeType;

					// don't get/set properties on text, comment and attribute nodes
					if (!elem || nType === 3 || nType === 8 || nType === 2) {
						return;
					}

					notxml = nType !== 1 || !JQXLite.isXMLDoc(elem);

					if (notxml) {
						// Fix name and attach hooks
						name = JQXLite.propFix[name] || name;
						hooks = JQXLite.propHooks[name];
					}

					if (value !== undefined) {
						if (hooks && "set" in hooks && (ret = hooks.set(elem, value, name)) !== undefined) {
							return ret;

						} else {
							return (elem[name] = value);
						}

					} else {
						if (hooks && "get" in hooks && (ret = hooks.get(elem, name)) !== null) {
							return ret;

						} else {
							return elem[name];
						}
					}
				},

				propHooks: {
					tabIndex: {
						get: function (elem) {
							// elem.tabIndex doesn't always return the correct value when it hasn't been explicitly set
							// http://fluidproject.org/blog/2008/01/09/getting-setting-and-removing-tabindex-values-with-javascript/
							var attributeNode = elem.getAttributeNode("tabindex");

							return attributeNode && attributeNode.specified ?
								parseInt(attributeNode.value, 10) :
								rfocusable.test(elem.nodeName) || rclickable.test(elem.nodeName) && elem.href ?
									0 :
									undefined;
						}
					}
				}
			});

			// Hook for boolean attributes
			boolHook = {
				get: function (elem, name) {
					// Align boolean attributes with corresponding properties
					// Fall back to attribute presence where some booleans are not supported
					var attrNode,
						property = JQXLite.prop(elem, name);
					return property === true || typeof property !== "boolean" && (attrNode = elem.getAttributeNode(name)) && attrNode.nodeValue !== false ?
						name.toLowerCase() :
						undefined;
				},
				set: function (elem, value, name) {
					var propName;
					if (value === false) {
						// Remove boolean attributes when set to false
						JQXLite.removeAttr(elem, name);
					} else {
						// value is true since we know at this point it's type boolean and not false
						// Set boolean attributes to the same name and set the DOM property
						propName = JQXLite.propFix[name] || name;
						if (propName in elem) {
							// Only set the IDL specifically if it already exists on the element
							elem[propName] = true;
						}

						elem.setAttribute(name, name.toLowerCase());
					}
					return name;
				}
			};

			// IE6/7 call enctype encoding
			if (!JQXLite.support.enctype) {
				JQXLite.propFix.enctype = "encoding";
			}

			var rformElems = /^(?:textarea|input|select)$/i,
				rtypenamespace = /^([^\.]*|)(?:\.(.+)|)$/,
				rhoverHack = /(?:^|\s)hover(\.\S+|)\b/,
				rkeyEvent = /^key/,
				rmouseEvent = /^(?:mouse|contextmenu)|click/,
				rfocusMorph = /^(?:focusinfocus|focusoutblur)$/,
				hoverHack = function (events) {
					return JQXLite.event.special.hover ? events : events.replace(rhoverHack, "mouseenter$1 mouseleave$1");
				};

			/*
			 * Helper functions for managing events -- not part of the public interface.
			 * Props to Dean Edwards' addEvent library for many of the ideas.
			 */
			JQXLite.event = {

				add: function (elem, types, handler, data, selector) {

					var elemData, eventHandle, events,
						t, tns, type, namespaces, handleObj,
						handleObjIn, handlers, special;

					// Don't attach events to noData or text/comment nodes (allow plain objects tho)
					if (elem.nodeType === 3 || elem.nodeType === 8 || !types || !handler || !(elemData = JQXLite._data(elem))) {
						return;
					}

					// Caller can pass in an object of custom data in lieu of the handler
					if (handler.handler) {
						handleObjIn = handler;
						handler = handleObjIn.handler;
						selector = handleObjIn.selector;
					}

					// Make sure that the handler has a unique ID, used to find/remove it later
					if (!handler.guid) {
						handler.guid = JQXLite.guid++;
					}

					// Init the element's event structure and main handler, if this is the first
					events = elemData.events;
					if (!events) {
						elemData.events = events = {};
					}
					eventHandle = elemData.handle;
					if (!eventHandle) {
						elemData.handle = eventHandle = function (e) {
							// Discard the second event of a JQXLite.event.trigger() and
							// when an event is called after a page has unloaded
							return typeof JQXLite !== "undefined" && (!e || JQXLite.event.triggered !== e.type) ?
								JQXLite.event.dispatch.apply(eventHandle.elem, arguments) :
								undefined;
						};
						// Add elem as a property of the handle fn to prevent a memory leak with IE non-native events
						eventHandle.elem = elem;
					}

					// Handle multiple events separated by a space
					// JQXLite(...).bind("mouseover mouseout", fn);
					types = JQXLite.trim(hoverHack(types)).split(" ");
					for (t = 0; t < types.length; t++) {

						tns = rtypenamespace.exec(types[t]) || [];
						type = tns[1];
						namespaces = (tns[2] || "").split(".").sort();

						// If event changes its type, use the special event handlers for the changed type
						special = JQXLite.event.special[type] || {};

						// If selector defined, determine special event api type, otherwise given type
						type = (selector ? special.delegateType : special.bindType) || type;

						// Update special based on newly reset type
						special = JQXLite.event.special[type] || {};

						// handleObj is passed to all event handlers
						handleObj = JQXLite.extend({
							type: type,
							origType: tns[1],
							data: data,
							handler: handler,
							guid: handler.guid,
							selector: selector,
							needsContext: selector && JQXLite.expr.match.needsContext.test(selector),
							namespace: namespaces.join(".")
						}, handleObjIn);

						// Init the event handler queue if we're the first
						handlers = events[type];
						if (!handlers) {
							handlers = events[type] = [];
							handlers.delegateCount = 0;

							// Only use addEventListener/attachEvent if the special events handler returns false
							if (!special.setup || special.setup.call(elem, data, namespaces, eventHandle) === false) {
								// Bind the global event handler to the element
								if (elem.addEventListener) {
									if (data && data.passive !== undefined) {
										elem.addEventListener(type, eventHandle, data);
									}
									else {
										elem.addEventListener(type, eventHandle, false);
									}
								} else if (elem.attachEvent) {
									elem.attachEvent("on" + type, eventHandle);
								}
							}
						}

						if (special.add) {
							special.add.call(elem, handleObj);

							if (!handleObj.handler.guid) {
								handleObj.handler.guid = handler.guid;
							}
						}

						// Add to the element's handler list, delegates in front
						if (selector) {
							handlers.splice(handlers.delegateCount++, 0, handleObj);
						} else {
							handlers.push(handleObj);
						}

						// Keep track of which events have ever been used, for event optimization
						JQXLite.event.global[type] = true;
					}

					// Nullify elem to prevent memory leaks in IE
					elem = null;
				},

				global: {},

				// Detach an event or set of events from an element
				remove: function (elem, types, handler, selector, mappedTypes) {

					var t, tns, type, origType, namespaces, origCount,
						j, events, special, eventType, handleObj,
						elemData = JQXLite.hasData(elem) && JQXLite._data(elem);

					if (!elemData || !(events = elemData.events)) {
						return;
					}

					// Once for each type.namespace in types; type may be omitted
					types = JQXLite.trim(hoverHack(types || "")).split(" ");
					for (t = 0; t < types.length; t++) {
						tns = rtypenamespace.exec(types[t]) || [];
						type = origType = tns[1];
						namespaces = tns[2];

						// Unbind all events (on this namespace, if provided) for the element
						if (!type) {
							for (type in events) {
								JQXLite.event.remove(elem, type + types[t], handler, selector, true);
							}
							continue;
						}

						special = JQXLite.event.special[type] || {};
						type = (selector ? special.delegateType : special.bindType) || type;
						eventType = events[type] || [];
						origCount = eventType.length;
						namespaces = namespaces ? new RegExp("(^|\\.)" + namespaces.split(".").sort().join("\\.(?:.*\\.|)") + "(\\.|$)") : null;

						// Remove matching events
						for (j = 0; j < eventType.length; j++) {
							handleObj = eventType[j];

							if ((mappedTypes || origType === handleObj.origType) &&
								(!handler || handler.guid === handleObj.guid) &&
								(!namespaces || namespaces.test(handleObj.namespace)) &&
								(!selector || selector === handleObj.selector || selector === "**" && handleObj.selector)) {
								eventType.splice(j--, 1);

								if (handleObj.selector) {
									eventType.delegateCount--;
								}
								if (special.remove) {
									special.remove.call(elem, handleObj);
								}
							}
						}

						// Remove generic event handler if we removed something and no more handlers exist
						// (avoids potential for endless recursion during removal of special event handlers)
						if (eventType.length === 0 && origCount !== eventType.length) {
							if (!special.teardown || special.teardown.call(elem, namespaces, elemData.handle) === false) {
								JQXLite.removeEvent(elem, type, elemData.handle);
							}

							delete events[type];
						}
					}

					// Remove the expando if it's no longer used
					if (JQXLite.isEmptyObject(events)) {
						delete elemData.handle;

						// removeData also checks for emptiness and clears the expando if empty
						// so use it instead of delete
						JQXLite.removeData(elem, "events", true);
					}
				},

				// Events that are safe to short-circuit if no handlers are attached.
				// Native DOM events should not be added, they may have inline handlers.
				customEvent: {
					"getData": true,
					"setData": true,
					"changeData": true
				},

				trigger: function (event, data, elem, onlyHandlers) {
					// Don't do events on text and comment nodes
					if (elem && (elem.nodeType === 3 || elem.nodeType === 8)) {
						return;
					}

					// Event object or event type
					var cache, exclusive, i, cur, old, ontype, special, handle, eventPath, bubbleType,
						type = event.type || event,
						namespaces = [];

					// focus/blur morphs to focusin/out; ensure we're not firing them right now
					if (rfocusMorph.test(type + JQXLite.event.triggered)) {
						return;
					}

					if (type.indexOf("!") >= 0) {
						// Exclusive events trigger only for the exact event (no namespaces)
						type = type.slice(0, -1);
						exclusive = true;
					}

					if (type.indexOf(".") >= 0) {
						// Namespaced trigger; create a regexp to match event type in handle()
						namespaces = type.split(".");
						type = namespaces.shift();
						namespaces.sort();
					}

					if ((!elem || JQXLite.event.customEvent[type]) && !JQXLite.event.global[type]) {
						// No JQXLite handlers for this event type, and it can't have inline handlers
						return;
					}

					// Caller can pass in an Event, Object, or just an event type string
					event = typeof event === "object" ?
						// JQXLite.Event object
						event[JQXLite.expando] ? event :
							// Object literal
							new JQXLite.Event(type, event) :
						// Just the event type (string)
						new JQXLite.Event(type);

					event.type = type;
					event.isTrigger = true;
					event.exclusive = exclusive;
					event.namespace = namespaces.join(".");
					event.namespace_re = event.namespace ? new RegExp("(^|\\.)" + namespaces.join("\\.(?:.*\\.|)") + "(\\.|$)") : null;
					ontype = type.indexOf(":") < 0 ? "on" + type : "";

					// Handle a global trigger
					if (!elem) {

						// TODO: Stop taunting the data cache; remove global events and always attach to document
						cache = JQXLite.cache;
						for (i in cache) {
							if (cache[i].events && cache[i].events[type]) {
								JQXLite.event.trigger(event, data, cache[i].handle.elem, true);
							}
						}
						return;
					}

					// Clean up the event in case it is being reused
					event.result = undefined;
					if (!event.target) {
						event.target = elem;
					}

					// Clone any incoming data and prepend the event, creating the handler arg list
					data = data != null ? JQXLite.makeArray(data) : [];
					data.unshift(event);

					// Allow special events to draw outside the lines
					special = JQXLite.event.special[type] || {};
					if (special.trigger && special.trigger.apply(elem, data) === false) {
						return;
					}

					// Determine event propagation path in advance, per W3C events spec (#9951)
					// Bubble up to document, then to window; watch for a global ownerDocument var (#9724)
					eventPath = [[elem, special.bindType || type]];
					if (!onlyHandlers && !special.noBubble && !JQXLite.isWindow(elem)) {

						bubbleType = special.delegateType || type;
						cur = rfocusMorph.test(bubbleType + type) ? elem : elem.parentNode;
						for (old = elem; cur; cur = cur.parentNode) {
							eventPath.push([cur, bubbleType]);
							old = cur;
						}

						// Only add window if we got to document (e.g., not plain obj or detached DOM)
						if (old === (elem.ownerDocument || document)) {
							eventPath.push([old.defaultView || old.parentWindow || window, bubbleType]);
						}
					}

					// Fire handlers on the event path
					for (i = 0; i < eventPath.length && !event.isPropagationStopped(); i++) {

						cur = eventPath[i][0];
						event.type = eventPath[i][1];

						handle = (JQXLite._data(cur, "events") || {})[event.type] && JQXLite._data(cur, "handle");
						if (handle) {
							handle.apply(cur, data);
						}
						// Note that this is a bare JS function and not a JQXLite handler
						handle = ontype && cur[ontype];
						if (handle && JQXLite.acceptData(cur) && handle.apply && handle.apply(cur, data) === false) {
							event.preventDefault();
						}
					}
					event.type = type;

					// If nobody prevented the default action, do it now
					if (!onlyHandlers && !event.isDefaultPrevented()) {

						if ((!special._default || special._default.apply(elem.ownerDocument, data) === false) &&
							!(type === "click" && JQXLite.nodeName(elem, "a")) && JQXLite.acceptData(elem)) {

							// Call a native DOM method on the target with the same name name as the event.
							// Can't use an .isFunction() check here because IE6/7 fails that test.
							// Don't do default actions on window, that's where global variables be (#6170)
							// IE<9 dies on focus/blur to hidden element (#1486)
							if (ontype && elem[type] && ((type !== "focus" && type !== "blur") || event.target.offsetWidth !== 0) && !JQXLite.isWindow(elem)) {

								// Don't re-trigger an onFOO event when we call its FOO() method
								old = elem[ontype];

								if (old) {
									elem[ontype] = null;
								}

								// Prevent re-triggering of the same event, since we already bubbled it above
								JQXLite.event.triggered = type;
								elem[type]();
								JQXLite.event.triggered = undefined;

								if (old) {
									elem[ontype] = old;
								}
							}
						}
					}

					return event.result;
				},

				dispatch: function (event) {

					// Make a writable JQXLite.Event from the native event object
					event = JQXLite.event.fix(event || window.event);

					var i, j, cur, ret, selMatch, matched, matches, handleObj, sel, related,
						handlers = ((JQXLite._data(this, "events") || {})[event.type] || []),
						delegateCount = handlers.delegateCount,
						args = core_slice.call(arguments),
						run_all = !event.exclusive && !event.namespace,
						special = JQXLite.event.special[event.type] || {},
						handlerQueue = [];

					// Use the fix-ed JQXLite.Event rather than the (read-only) native event
					args[0] = event;
					event.delegateTarget = this;

					// Call the preDispatch hook for the mapped type, and let it bail if desired
					if (special.preDispatch && special.preDispatch.call(this, event) === false) {
						return;
					}

					// Determine handlers that should run if there are delegated events
					// Avoid non-left-click bubbling in Firefox (#3861)
					if (delegateCount && !(event.button && event.type === "click")) {

						for (cur = event.target; cur != this; cur = cur.parentNode || this) {

							// Don't process clicks (ONLY) on disabled elements (#6911, #8165, #11382, #11764)
							if (cur.disabled !== true || event.type !== "click") {
								selMatch = {};
								matches = [];
								for (i = 0; i < delegateCount; i++) {
									handleObj = handlers[i];
									sel = handleObj.selector;

									if (selMatch[sel] === undefined) {
										selMatch[sel] = handleObj.needsContext ?
											JQXLite(sel, this).index(cur) >= 0 :
											JQXLite.find(sel, this, null, [cur]).length;
									}
									if (selMatch[sel]) {
										matches.push(handleObj);
									}
								}
								if (matches.length) {
									handlerQueue.push({ elem: cur, matches: matches });
								}
							}
						}
					}

					// Add the remaining (directly-bound) handlers
					if (handlers.length > delegateCount) {
						handlerQueue.push({ elem: this, matches: handlers.slice(delegateCount) });
					}

					// Run delegates first; they may want to stop propagation beneath us
					for (i = 0; i < handlerQueue.length && !event.isPropagationStopped(); i++) {
						matched = handlerQueue[i];
						event.currentTarget = matched.elem;

						for (j = 0; j < matched.matches.length && !event.isImmediatePropagationStopped(); j++) {
							handleObj = matched.matches[j];

							// Triggered event must either 1) be non-exclusive and have no namespace, or
							// 2) have namespace(s) a subset or equal to those in the bound event (both can have no namespace).
							if (run_all || (!event.namespace && !handleObj.namespace) || event.namespace_re && event.namespace_re.test(handleObj.namespace)) {

								event.data = handleObj.data;
								event.handleObj = handleObj;

								ret = ((JQXLite.event.special[handleObj.origType] || {}).handle || handleObj.handler)
									.apply(matched.elem, args);

								if (ret !== undefined) {
									event.result = ret;
									if (ret === false) {
										event.preventDefault();
										event.stopPropagation();
									}
								}
							}
						}
					}

					// Call the postDispatch hook for the mapped type
					if (special.postDispatch) {
						special.postDispatch.call(this, event);
					}

					return event.result;
				},

				// Includes some event props shared by KeyEvent and MouseEvent
				// *** attrChange attrName relatedNode srcElement  are not normalized, non-W3C, deprecated, will be removed in 1.8 ***
				props: "attrChange attrName relatedNode srcElement altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),

				fixHooks: {},

				keyHooks: {
					props: "char charCode key keyCode".split(" "),
					filter: function (event, original) {

						// Add which for key events
						if (event.which == null) {
							event.which = original.charCode != null ? original.charCode : original.keyCode;
						}

						return event;
					}
				},

				mouseHooks: {
					props: "button buttons clientX clientY fromElement offsetX offsetY pageX pageY screenX screenY toElement".split(" "),
					filter: function (event, original) {
						var eventDoc, doc, body,
							button = original.button,
							fromElement = original.fromElement;

						// Calculate pageX/Y if missing and clientX/Y available
						if (event.pageX == null && original.clientX != null) {
							eventDoc = event.target.ownerDocument || document;
							doc = eventDoc.documentElement;
							body = eventDoc.body;

							event.pageX = original.clientX + (doc && doc.scrollLeft || body && body.scrollLeft || 0) - (doc && doc.clientLeft || body && body.clientLeft || 0);
							event.pageY = original.clientY + (doc && doc.scrollTop || body && body.scrollTop || 0) - (doc && doc.clientTop || body && body.clientTop || 0);
						}

						// Add relatedTarget, if necessary
						if (!event.relatedTarget && fromElement) {
							event.relatedTarget = fromElement === event.target ? original.toElement : fromElement;
						}

						// Add which for click: 1 === left; 2 === middle; 3 === right
						// Note: button is not normalized, so don't use it
						if (!event.which && button !== undefined) {
							event.which = (button & 1 ? 1 : (button & 2 ? 3 : (button & 4 ? 2 : 0)));
						}

						return event;
					}
				},

				fix: function (event) {
					if (event[JQXLite.expando]) {
						return event;
					}

					// Create a writable copy of the event object and normalize some properties
					var i, prop,
						originalEvent = event,
						fixHook = JQXLite.event.fixHooks[event.type] || {},
						copy = fixHook.props ? this.props.concat(fixHook.props) : this.props;

					event = JQXLite.Event(originalEvent);

					for (i = copy.length; i;) {
						prop = copy[--i];
						event[prop] = originalEvent[prop];
					}

					// Fix target property, if necessary (#1925, IE 6/7/8 & Safari2)
					if (!event.target) {
						event.target = originalEvent.srcElement || document;
					}

					// Target should not be a text node (#504, Safari)
					if (event.target.nodeType === 3) {
						event.target = event.target.parentNode;
					}

					// For mouse/key events, metaKey==false if it's undefined (#3368, #11328; IE6/7/8)
					event.metaKey = !!event.metaKey;

					return fixHook.filter ? fixHook.filter(event, originalEvent) : event;
				},

				special: {
					load: {
						// Prevent triggered image.load events from bubbling to window.load
						noBubble: true
					},

					focus: {
						delegateType: "focusin"
					},
					blur: {
						delegateType: "focusout"
					},

					beforeunload: {
						setup: function (data, namespaces, eventHandle) {
							// We only want to do this special case on windows
							if (JQXLite.isWindow(this)) {
								this.onbeforeunload = eventHandle;
							}
						},

						teardown: function (namespaces, eventHandle) {
							if (this.onbeforeunload === eventHandle) {
								this.onbeforeunload = null;
							}
						}
					}
				},

				simulate: function (type, elem, event, bubble) {
					// Piggyback on a donor event to simulate a different one.
					// Fake originalEvent to avoid donor's stopPropagation, but if the
					// simulated event prevents default then we do the same on the donor.
					var e = JQXLite.extend(
						new JQXLite.Event(),
						event,
						{
							type: type,
							isSimulated: true,
							originalEvent: {}
						}
					);
					if (bubble) {
						JQXLite.event.trigger(e, null, elem);
					} else {
						JQXLite.event.dispatch.call(elem, e);
					}
					if (e.isDefaultPrevented()) {
						event.preventDefault();
					}
				}
			};

			// Some plugins are using, but it's undocumented/deprecated and will be removed.
			// The 1.7 special event interface should provide all the hooks needed now.
			JQXLite.event.handle = JQXLite.event.dispatch;

			JQXLite.removeEvent = document.removeEventListener ?
				function (elem, type, handle) {
					if (elem.removeEventListener) {
						elem.removeEventListener(type, handle, false);
					}
				} :
				function (elem, type, handle) {
					var name = "on" + type;

					if (elem.detachEvent) {

						// #8545, #7054, preventing memory leaks for custom events in IE6-8
						// detachEvent needed property on element, by name of that event, to properly expose it to GC
						if (typeof elem[name] === "undefined") {
							elem[name] = null;
						}

						elem.detachEvent(name, handle);
					}
				};

			JQXLite.Event = function (src, props) {
				// Allow instantiation without the 'new' keyword
				if (!(this instanceof JQXLite.Event)) {
					return new JQXLite.Event(src, props);
				}

				// Event object
				if (src && src.type) {
					this.originalEvent = src;
					this.type = src.type;

					// Events bubbling up the document may have been marked as prevented
					// by a handler lower down the tree; reflect the correct value.
					this.isDefaultPrevented = (src.defaultPrevented || src.returnValue === false ||
						src.getPreventDefault && src.getPreventDefault()) ? returnTrue : returnFalse;

					// Event type
				} else {
					this.type = src;
				}

				// Put explicitly provided properties onto the event object
				if (props) {
					JQXLite.extend(this, props);
				}

				// Create a timestamp if incoming event doesn't have one
				this.timeStamp = src && src.timeStamp || JQXLite.now();

				// Mark it as fixed
				this[JQXLite.expando] = true;
			};

			function returnFalse() {
				return false;
			}
			function returnTrue() {
				return true;
			}

			// JQXLite.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
			// http://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
			JQXLite.Event.prototype = {
				preventDefault: function () {
					this.isDefaultPrevented = returnTrue;

					var e = this.originalEvent;
					if (!e) {
						return;
					}

					// if preventDefault exists run it on the original event
					if (e.preventDefault) {
						e.preventDefault();

						// otherwise set the returnValue property of the original event to false (IE)
					} else {
						e.returnValue = false;
					}
				},
				stopPropagation: function () {
					this.isPropagationStopped = returnTrue;

					var e = this.originalEvent;
					if (!e) {
						return;
					}
					// if stopPropagation exists run it on the original event
					if (e.stopPropagation) {
						e.stopPropagation();
					}
					// otherwise set the cancelBubble property of the original event to true (IE)
					e.cancelBubble = true;
				},
				stopImmediatePropagation: function () {
					this.isImmediatePropagationStopped = returnTrue;
					this.stopPropagation();
				},
				isDefaultPrevented: returnFalse,
				isPropagationStopped: returnFalse,
				isImmediatePropagationStopped: returnFalse
			};

			// Create mouseenter/leave events using mouseover/out and event-time checks
			JQXLite.each({
				mouseenter: "mouseover",
				mouseleave: "mouseout"
			}, function (orig, fix) {
				JQXLite.event.special[orig] = {
					delegateType: fix,
					bindType: fix,

					handle: function (event) {
						var ret,
							target = this,
							related = event.relatedTarget,
							handleObj = event.handleObj,
							selector = handleObj.selector;

						// For mousenter/leave call the handler if related is outside the target.
						// NB: No relatedTarget if the mouse left/entered the browser window
						if (!related || (related !== target && !JQXLite.contains(target, related))) {
							event.type = handleObj.origType;
							ret = handleObj.handler.apply(this, arguments);
							event.type = fix;
						}
						return ret;
					}
				};
			});

			JQXLite.fn.extend({

				on: function (types, selector, data, fn, /*INTERNAL*/ one) {
					var origFn, type;

					// Types can be a map of types/handlers
					if (typeof types === "object") {
						// ( types-Object, selector, data )
						if (typeof selector !== "string") { // && selector != null
							// ( types-Object, data )
							data = data || selector;
							selector = undefined;
						}
						for (type in types) {
							this.on(type, selector, data, types[type], one);
						}
						return this;
					}

					if (data == null && fn == null) {
						// ( types, fn )
						fn = selector;
						data = selector = undefined;
					} else if (fn == null) {
						if (typeof selector === "string") {
							// ( types, selector, fn )
							fn = data;
							data = undefined;
						} else {
							// ( types, data, fn )
							fn = data;
							data = selector;
							selector = undefined;
						}
					}
					if (fn === false) {
						fn = returnFalse;
					} else if (!fn) {
						return this;
					}

					if (one === 1) {
						origFn = fn;
						fn = function (event) {
							// Can use an empty set, since event contains the info
							JQXLite().off(event);
							return origFn.apply(this, arguments);
						};
						// Use same guid so caller can remove using origFn
						fn.guid = origFn.guid || (origFn.guid = JQXLite.guid++);
					}
					return this.each(function () {
						JQXLite.event.add(this, types, fn, data, selector);
					});
				},

				off: function (types, selector, fn) {
					var handleObj, type;
					if (types && types.preventDefault && types.handleObj) {
						// ( event )  dispatched JQXLite.Event
						handleObj = types.handleObj;
						JQXLite(types.delegateTarget).off(
							handleObj.namespace ? handleObj.origType + "." + handleObj.namespace : handleObj.origType,
							handleObj.selector,
							handleObj.handler
						);
						return this;
					}
					if (typeof types === "object") {
						// ( types-object [, selector] )
						for (type in types) {
							this.off(type, selector, types[type]);
						}
						return this;
					}
					if (selector === false || typeof selector === "function") {
						// ( types [, fn] )
						fn = selector;
						selector = undefined;
					}
					if (fn === false) {
						fn = returnFalse;
					}
					return this.each(function () {
						JQXLite.event.remove(this, types, fn, selector);
					});
				},

				delegate: function (selector, types, data, fn) {
					return this.on(types, selector, data, fn);
				},
				undelegate: function (selector, types, fn) {
					// ( namespace ) or ( selector, types [, fn] )
					return arguments.length === 1 ? this.off(selector, "**") : this.off(types, selector || "**", fn);
				},

				trigger: function (type, data) {
					return this.each(function () {
						JQXLite.event.trigger(type, data, this);
					});
				},
				triggerHandler: function (type, data) {
					if (this[0]) {
						return JQXLite.event.trigger(type, data, this[0], true);
					}
				},

				toggle: function (fn) {
					// Save reference to arguments for access in closure
					var args = arguments,
						guid = fn.guid || JQXLite.guid++,
						i = 0,
						toggler = function (event) {
							// Figure out which function to execute
							var lastToggle = (JQXLite._data(this, "lastToggle" + fn.guid) || 0) % i;
							JQXLite._data(this, "lastToggle" + fn.guid, lastToggle + 1);

							// Make sure that clicks stop
							event.preventDefault();

							// and execute the function
							return args[lastToggle].apply(this, arguments) || false;
						};

					// link all the functions, so any of them can unbind this click handler
					toggler.guid = guid;
					while (i < args.length) {
						args[i++].guid = guid;
					}

					return this.click(toggler);
				},

				hover: function (fnOver, fnOut) {
					return this.mouseenter(fnOver).mouseleave(fnOut || fnOver);
				}
			});

			JQXLite.each(("blur focus focusin focusout load resize scroll unload click dblclick " +
				"mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
				"change select submit keydown keypress keyup error contextmenu").split(" "), function (i, name) {

					// Handle event binding
					JQXLite.fn[name] = function (data, fn) {
						if (fn == null) {
							fn = data;
							data = null;
						}

						return arguments.length > 0 ?
							this.on(name, null, data, fn) :
							this.trigger(name);
					};

					if (rkeyEvent.test(name)) {
						JQXLite.event.fixHooks[name] = JQXLite.event.keyHooks;
					}

					if (rmouseEvent.test(name)) {
						JQXLite.event.fixHooks[name] = JQXLite.event.mouseHooks;
					}
				});
			/*!
			 * Sizzle CSS Selector Engine
			 * Copyright 2012 JQXLite Foundation and other contributors
			 * Released under the MIT license
			 * http://sizzlejs.com/
			 */
			(function (window, undefined) {

				var cachedruns,
					assertGetIdNotName,
					Expr,
					getText,
					isXML,
					contains,
					compile,
					sortOrder,
					hasDuplicate,
					outermostContext,

					baseHasDuplicate = true,
					strundefined = "undefined",

					expando = ("sizcache" + Math.random()).replace(".", ""),

					Token = String,
					document = window.document,
					docElem = document.documentElement,
					dirruns = 0,
					done = 0,
					pop = [].pop,
					push = [].push,
					slice = [].slice,
					// Use a stripped-down indexOf if a native one is unavailable
					indexOf = [].indexOf || function (elem) {
						var i = 0,
							len = this.length;
						for (; i < len; i++) {
							if (this[i] === elem) {
								return i;
							}
						}
						return -1;
					},

					// Augment a function for special use by Sizzle
					markFunction = function (fn, value) {
						fn[expando] = value == null || value;
						return fn;
					},

					createCache = function () {
						var cache = {},
							keys = [];

						return markFunction(function (key, value) {
							// Only keep the most recent entries
							if (keys.push(key) > Expr.cacheLength) {
								delete cache[keys.shift()];
							}

							// Retrieve with (key + " ") to avoid collision with native Object.prototype properties (see Issue #157)
							return (cache[key + " "] = value);
						}, cache);
					},

					classCache = createCache(),
					tokenCache = createCache(),
					compilerCache = createCache(),

					// Regex

					// Whitespace characters http://www.w3.org/TR/css3-selectors/#whitespace
					whitespace = "[\\x20\\t\\r\\n\\f]",
					// http://www.w3.org/TR/css3-syntax/#characters
					characterEncoding = "(?:\\\\.|[-\\w]|[^\\x00-\\xa0])+",

					// Loosely modeled on CSS identifier characters
					// An unquoted value should be a CSS identifier (http://www.w3.org/TR/css3-selectors/#attribute-selectors)
					// Proper syntax: http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
					identifier = characterEncoding.replace("w", "w#"),

					// Acceptable operators http://www.w3.org/TR/selectors/#attribute-selectors
					operators = "([*^$|!~]?=)",
					attributes = "\\[" + whitespace + "*(" + characterEncoding + ")" + whitespace +
						"*(?:" + operators + whitespace + "*(?:(['\"])((?:\\\\.|[^\\\\])*?)\\3|(" + identifier + ")|)|)" + whitespace + "*\\]",

					// Prefer arguments not in parens/brackets,
					//   then attribute selectors and non-pseudos (denoted by :),
					//   then anything else
					// These preferences are here to reduce the number of selectors
					//   needing tokenize in the PSEUDO preFilter
					pseudos = ":(" + characterEncoding + ")(?:\\((?:(['\"])((?:\\\\.|[^\\\\])*?)\\2|([^()[\\]]*|(?:(?:" + attributes + ")|[^:]|\\\\.)*|.*))\\)|)",

					// For matchExpr.POS and matchExpr.needsContext
					pos = ":(even|odd|eq|gt|lt|nth|first|last)(?:\\(" + whitespace +
						"*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)",

					// Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
					rtrim = new RegExp("^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g"),

					rcomma = new RegExp("^" + whitespace + "*," + whitespace + "*"),
					rcombinators = new RegExp("^" + whitespace + "*([\\x20\\t\\r\\n\\f>+~])" + whitespace + "*"),
					rpseudo = new RegExp(pseudos),

					// Easily-parseable/retrievable ID or TAG or CLASS selectors
					rquickExpr = /^(?:#([\w\-]+)|(\w+)|\.([\w\-]+))$/,

					rnot = /^:not/,
					rsibling = /[\x20\t\r\n\f]*[+~]/,
					rendsWithNot = /:not\($/,

					rheader = /h\d/i,
					rinputs = /input|select|textarea|button/i,

					rbackslash = /\\(?!\\)/g,

					matchExpr = {
						"ID": new RegExp("^#(" + characterEncoding + ")"),
						"CLASS": new RegExp("^\\.(" + characterEncoding + ")"),
						"NAME": new RegExp("^\\[name=['\"]?(" + characterEncoding + ")['\"]?\\]"),
						"TAG": new RegExp("^(" + characterEncoding.replace("w", "w*") + ")"),
						"ATTR": new RegExp("^" + attributes),
						"PSEUDO": new RegExp("^" + pseudos),
						"POS": new RegExp(pos, "i"),
						"CHILD": new RegExp("^:(only|nth|first|last)-child(?:\\(" + whitespace +
							"*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" + whitespace +
							"*(\\d+)|))" + whitespace + "*\\)|)", "i"),
						// For use in libraries implementing .is()
						"needsContext": new RegExp("^" + whitespace + "*[>+~]|" + pos, "i")
					},

					// Support

					// Used for testing something on an element
					assert = function (fn) {
						var div = document.createElement("div");

						try {
							return fn(div);
						} catch (e) {
							return false;
						} finally {
							// release memory in IE
							div = null;
						}
					},

					// Check if getElementsByTagName("*") returns only elements
					assertTagNameNoComments = assert(function (div) {
						div.appendChild(document.createComment(""));
						return !div.getElementsByTagName("*").length;
					}),

					// Check if getAttribute returns normalized href attributes
					assertHrefNotNormalized = assert(function (div) {
						div.innerHTML = "<a href='#'></a>";
						return div.firstChild && typeof div.firstChild.getAttribute !== strundefined &&
							div.firstChild.getAttribute("href") === "#";
					}),

					// Check if attributes should be retrieved by attribute nodes
					assertAttributes = assert(function (div) {
						div.innerHTML = "<select></select>";
						var type = typeof div.lastChild.getAttribute("multiple");
						// IE8 returns a string for some attributes even when not present
						return type !== "boolean" && type !== "string";
					}),

					// Check if getElementsByClassName can be trusted
					assertUsableClassName = assert(function (div) {
						// Opera can't find a second classname (in 9.6)
						div.innerHTML = "<div class='hidden e'></div><div class='hidden'></div>";
						if (!div.getElementsByClassName || !div.getElementsByClassName("e").length) {
							return false;
						}

						// Safari 3.2 caches class attributes and doesn't catch changes
						div.lastChild.className = "e";
						return div.getElementsByClassName("e").length === 2;
					}),

					// Check if getElementById returns elements by name
					// Check if getElementsByName privileges form controls or returns elements by ID
					assertUsableName = assert(function (div) {
						// Inject content
						div.id = expando + 0;
						div.innerHTML = "<a name='" + expando + "'></a><div name='" + expando + "'></div>";
						docElem.insertBefore(div, docElem.firstChild);

						// Test
						var pass = document.getElementsByName &&
							// buggy browsers will return fewer than the correct 2
							document.getElementsByName(expando).length === 2 +
							// buggy browsers will return more than the correct 0
							document.getElementsByName(expando + 0).length;
						assertGetIdNotName = !document.getElementById(expando);

						// Cleanup
						docElem.removeChild(div);

						return pass;
					});

				// If slice is not available, provide a backup
				try {
					slice.call(docElem.childNodes, 0)[0].nodeType;
				} catch (e) {
					slice = function (i) {
						var elem,
							results = [];
						for (; (elem = this[i]); i++) {
							results.push(elem);
						}
						return results;
					};
				}

				function Sizzle(selector, context, results, seed) {
					results = results || [];
					context = context || document;
					var match, elem, xml, m,
						nodeType = context.nodeType;

					if (!selector || typeof selector !== "string") {
						return results;
					}

					if (nodeType !== 1 && nodeType !== 9) {
						return [];
					}

					xml = isXML(context);

					if (!xml && !seed) {
						if ((match = rquickExpr.exec(selector))) {
							// Speed-up: Sizzle("#ID")
							if ((m = match[1])) {
								if (nodeType === 9) {
									elem = context.getElementById(m);
									// Check parentNode to catch when Blackberry 4.6 returns
									// nodes that are no longer in the document #6963
									if (elem && elem.parentNode) {
										// Handle the case where IE, Opera, and Webkit return items
										// by name instead of ID
										if (elem.id === m) {
											results.push(elem);
											return results;
										}
									} else {
										return results;
									}
								} else {
									// Context is not a document
									if (context.ownerDocument && (elem = context.ownerDocument.getElementById(m)) &&
										contains(context, elem) && elem.id === m) {
										results.push(elem);
										return results;
									}
								}

								// Speed-up: Sizzle("TAG")
							} else if (match[2]) {
								push.apply(results, slice.call(context.getElementsByTagName(selector), 0));
								return results;

								// Speed-up: Sizzle(".CLASS")
							} else if ((m = match[3]) && assertUsableClassName && context.getElementsByClassName) {
								push.apply(results, slice.call(context.getElementsByClassName(m), 0));
								return results;
							}
						}
					}

					// All others
					return select(selector.replace(rtrim, "$1"), context, results, seed, xml);
				}

				Sizzle.matches = function (expr, elements) {
					return Sizzle(expr, null, null, elements);
				};

				Sizzle.matchesSelector = function (elem, expr) {
					return Sizzle(expr, null, null, [elem]).length > 0;
				};

				// Returns a function to use in pseudos for input types
				function createInputPseudo(type) {
					return function (elem) {
						var name = elem.nodeName.toLowerCase();
						return name === "input" && elem.type === type;
					};
				}

				// Returns a function to use in pseudos for buttons
				function createButtonPseudo(type) {
					return function (elem) {
						var name = elem.nodeName.toLowerCase();
						return (name === "input" || name === "button") && elem.type === type;
					};
				}

				// Returns a function to use in pseudos for positionals
				function createPositionalPseudo(fn) {
					return markFunction(function (argument) {
						argument = +argument;
						return markFunction(function (seed, matches) {
							var j,
								matchIndexes = fn([], seed.length, argument),
								i = matchIndexes.length;

							// Match elements found at the specified indexes
							while (i--) {
								if (seed[(j = matchIndexes[i])]) {
									seed[j] = !(matches[j] = seed[j]);
								}
							}
						});
					});
				}

				/**
				 * Utility function for retrieving the text value of an array of DOM nodes
				 * @param {Array|Element} elem
				 */
				getText = Sizzle.getText = function (elem) {
					var node,
						ret = "",
						i = 0,
						nodeType = elem.nodeType;

					if (nodeType) {
						if (nodeType === 1 || nodeType === 9 || nodeType === 11) {
							// Use textContent for elements
							// innerText usage removed for consistency of new lines (see #11153)
							if (typeof elem.textContent === "string") {
								return elem.textContent;
							} else {
								// Traverse its children
								for (elem = elem.firstChild; elem; elem = elem.nextSibling) {
									ret += getText(elem);
								}
							}
						} else if (nodeType === 3 || nodeType === 4) {
							return elem.nodeValue;
						}
						// Do not include comment or processing instruction nodes
					} else {

						// If no nodeType, this is expected to be an array
						for (; (node = elem[i]); i++) {
							// Do not traverse comment nodes
							ret += getText(node);
						}
					}
					return ret;
				};

				isXML = Sizzle.isXML = function (elem) {
					// documentElement is verified for cases where it doesn't yet exist
					// (such as loading iframes in IE - #4833)
					var documentElement = elem && (elem.ownerDocument || elem).documentElement;
					return documentElement ? documentElement.nodeName !== "HTML" : false;
				};

				// Element contains another
				contains = Sizzle.contains = docElem.contains ?
					function (a, b) {
						var adown = a.nodeType === 9 ? a.documentElement : a,
							bup = b && b.parentNode;
						return a === bup || !!(bup && bup.nodeType === 1 && adown.contains && adown.contains(bup));
					} :
					docElem.compareDocumentPosition ?
						function (a, b) {
							return b && !!(a.compareDocumentPosition(b) & 16);
						} :
						function (a, b) {
							while ((b = b.parentNode)) {
								if (b === a) {
									return true;
								}
							}
							return false;
						};

				Sizzle.attr = function (elem, name) {
					var val,
						xml = isXML(elem);

					if (!xml) {
						name = name.toLowerCase();
					}
					if ((val = Expr.attrHandle[name])) {
						return val(elem);
					}
					if (xml || assertAttributes) {
						return elem.getAttribute(name);
					}
					val = elem.getAttributeNode(name);
					return val ?
						typeof elem[name] === "boolean" ?
							elem[name] ? name : null :
							val.specified ? val.value : null :
						null;
				};

				Expr = Sizzle.selectors = {

					// Can be adjusted by the user
					cacheLength: 50,

					createPseudo: markFunction,

					match: matchExpr,

					// IE6/7 return a modified href
					attrHandle: assertHrefNotNormalized ?
						{} :
						{
							"href": function (elem) {
								return elem.getAttribute("href", 2);
							},
							"type": function (elem) {
								return elem.getAttribute("type");
							}
						},

					find: {
						"ID": assertGetIdNotName ?
							function (id, context, xml) {
								if (typeof context.getElementById !== strundefined && !xml) {
									var m = context.getElementById(id);
									// Check parentNode to catch when Blackberry 4.6 returns
									// nodes that are no longer in the document #6963
									return m && m.parentNode ? [m] : [];
								}
							} :
							function (id, context, xml) {
								if (typeof context.getElementById !== strundefined && !xml) {
									var m = context.getElementById(id);

									return m ?
										m.id === id || typeof m.getAttributeNode !== strundefined && m.getAttributeNode("id").value === id ?
											[m] :
											undefined :
										[];
								}
							},

						"TAG": assertTagNameNoComments ?
							function (tag, context) {
								if (typeof context.getElementsByTagName !== strundefined) {
									return context.getElementsByTagName(tag);
								}
							} :
							function (tag, context) {
								var results = context.getElementsByTagName(tag);

								// Filter out possible comments
								if (tag === "*") {
									var elem,
										tmp = [],
										i = 0;

									for (; (elem = results[i]); i++) {
										if (elem.nodeType === 1) {
											tmp.push(elem);
										}
									}

									return tmp;
								}
								return results;
							},

						"NAME": assertUsableName && function (tag, context) {
							if (typeof context.getElementsByName !== strundefined) {
								return context.getElementsByName(name);
							}
						},

						"CLASS": assertUsableClassName && function (className, context, xml) {
							if (typeof context.getElementsByClassName !== strundefined && !xml) {
								return context.getElementsByClassName(className);
							}
						}
					},

					relative: {
						">": { dir: "parentNode", first: true },
						" ": { dir: "parentNode" },
						"+": { dir: "previousSibling", first: true },
						"~": { dir: "previousSibling" }
					},

					preFilter: {
						"ATTR": function (match) {
							match[1] = match[1].replace(rbackslash, "");

							// Move the given value to match[3] whether quoted or unquoted
							match[3] = (match[4] || match[5] || "").replace(rbackslash, "");

							if (match[2] === "~=") {
								match[3] = " " + match[3] + " ";
							}

							return match.slice(0, 4);
						},

						"CHILD": function (match) {
							/* matches from matchExpr["CHILD"]
								1 type (only|nth|...)
								2 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
								3 xn-component of xn+y argument ([+-]?\d*n|)
								4 sign of xn-component
								5 x of xn-component
								6 sign of y-component
								7 y of y-component
							*/
							match[1] = match[1].toLowerCase();

							if (match[1] === "nth") {
								// nth-child requires argument
								if (!match[2]) {
									Sizzle.error(match[0]);
								}

								// numeric x and y parameters for Expr.filter.CHILD
								// remember that false/true cast respectively to 0/1
								match[3] = +(match[3] ? match[4] + (match[5] || 1) : 2 * (match[2] === "even" || match[2] === "odd"));
								match[4] = +((match[6] + match[7]) || match[2] === "odd");

								// other types prohibit arguments
							} else if (match[2]) {
								Sizzle.error(match[0]);
							}

							return match;
						},

						"PSEUDO": function (match) {
							var unquoted, excess;
							if (matchExpr["CHILD"].test(match[0])) {
								return null;
							}

							if (match[3]) {
								match[2] = match[3];
							} else if ((unquoted = match[4])) {
								// Only check arguments that contain a pseudo
								if (rpseudo.test(unquoted) &&
									// Get excess from tokenize (recursively)
									(excess = tokenize(unquoted, true)) &&
									// advance to the next closing parenthesis
									(excess = unquoted.indexOf(")", unquoted.length - excess) - unquoted.length)) {

									// excess is a negative index
									unquoted = unquoted.slice(0, excess);
									match[0] = match[0].slice(0, excess);
								}
								match[2] = unquoted;
							}

							// Return only captures needed by the pseudo filter method (type and argument)
							return match.slice(0, 3);
						}
					},

					filter: {
						"ID": assertGetIdNotName ?
							function (id) {
								id = id.replace(rbackslash, "");
								return function (elem) {
									return elem.getAttribute("id") === id;
								};
							} :
							function (id) {
								id = id.replace(rbackslash, "");
								return function (elem) {
									var node = typeof elem.getAttributeNode !== strundefined && elem.getAttributeNode("id");
									return node && node.value === id;
								};
							},

						"TAG": function (nodeName) {
							if (nodeName === "*") {
								return function () { return true; };
							}
							nodeName = nodeName.replace(rbackslash, "").toLowerCase();

							return function (elem) {
								return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
							};
						},

						"CLASS": function (className) {
							var pattern = classCache[expando][className + " "];

							return pattern ||
								(pattern = new RegExp("(^|" + whitespace + ")" + className + "(" + whitespace + "|$)")) &&
								classCache(className, function (elem) {
									return pattern.test(elem.className || (typeof elem.getAttribute !== strundefined && elem.getAttribute("class")) || "");
								});
						},

						"ATTR": function (name, operator, check) {
							return function (elem, context) {
								var result = Sizzle.attr(elem, name);

								if (result == null) {
									return operator === "!=";
								}
								if (!operator) {
									return true;
								}

								result += "";

								return operator === "=" ? result === check :
									operator === "!=" ? result !== check :
										operator === "^=" ? check && result.indexOf(check) === 0 :
											operator === "*=" ? check && result.indexOf(check) > -1 :
												operator === "$=" ? check && result.substr(result.length - check.length) === check :
													operator === "~=" ? (" " + result + " ").indexOf(check) > -1 :
														operator === "|=" ? result === check || result.substr(0, check.length + 1) === check + "-" :
															false;
							};
						},

						"CHILD": function (type, argument, first, last) {

							if (type === "nth") {
								return function (elem) {
									var node, diff,
										parent = elem.parentNode;

									if (first === 1 && last === 0) {
										return true;
									}

									if (parent) {
										diff = 0;
										for (node = parent.firstChild; node; node = node.nextSibling) {
											if (node.nodeType === 1) {
												diff++;
												if (elem === node) {
													break;
												}
											}
										}
									}

									// Incorporate the offset (or cast to NaN), then check against cycle size
									diff -= last;
									return diff === first || (diff % first === 0 && diff / first >= 0);
								};
							}

							return function (elem) {
								var node = elem;

								switch (type) {
									case "only":
									case "first":
										while ((node = node.previousSibling)) {
											if (node.nodeType === 1) {
												return false;
											}
										}

										if (type === "first") {
											return true;
										}

										node = elem;

									/* falls through */
									case "last":
										while ((node = node.nextSibling)) {
											if (node.nodeType === 1) {
												return false;
											}
										}

										return true;
								}
							};
						},

						"PSEUDO": function (pseudo, argument) {
							// pseudo-class names are case-insensitive
							// http://www.w3.org/TR/selectors/#pseudo-classes
							// Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
							// Remember that setFilters inherits from pseudos
							var args,
								fn = Expr.pseudos[pseudo] || Expr.setFilters[pseudo.toLowerCase()] ||
									Sizzle.error("unsupported pseudo: " + pseudo);

							// The user may use createPseudo to indicate that
							// arguments are needed to create the filter function
							// just as Sizzle does
							if (fn[expando]) {
								return fn(argument);
							}

							// But maintain support for old signatures
							if (fn.length > 1) {
								args = [pseudo, pseudo, "", argument];
								return Expr.setFilters.hasOwnProperty(pseudo.toLowerCase()) ?
									markFunction(function (seed, matches) {
										var idx,
											matched = fn(seed, argument),
											i = matched.length;
										while (i--) {
											idx = indexOf.call(seed, matched[i]);
											seed[idx] = !(matches[idx] = matched[i]);
										}
									}) :
									function (elem) {
										return fn(elem, 0, args);
									};
							}

							return fn;
						}
					},

					pseudos: {
						"not": markFunction(function (selector) {
							// Trim the selector passed to compile
							// to avoid treating leading and trailing
							// spaces as combinators
							var input = [],
								results = [],
								matcher = compile(selector.replace(rtrim, "$1"));

							return matcher[expando] ?
								markFunction(function (seed, matches, context, xml) {
									var elem,
										unmatched = matcher(seed, null, xml, []),
										i = seed.length;

									// Match elements unmatched by `matcher`
									while (i--) {
										if ((elem = unmatched[i])) {
											seed[i] = !(matches[i] = elem);
										}
									}
								}) :
								function (elem, context, xml) {
									input[0] = elem;
									matcher(input, null, xml, results);
									return !results.pop();
								};
						}),

						"has": markFunction(function (selector) {
							return function (elem) {
								return Sizzle(selector, elem).length > 0;
							};
						}),

						"contains": markFunction(function (text) {
							return function (elem) {
								return (elem.textContent || elem.innerText || getText(elem)).indexOf(text) > -1;
							};
						}),

						"enabled": function (elem) {
							return elem.disabled === false;
						},

						"disabled": function (elem) {
							return elem.disabled === true;
						},

						"checked": function (elem) {
							// In CSS3, :checked should return both checked and selected elements
							// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
							var nodeName = elem.nodeName.toLowerCase();
							return (nodeName === "input" && !!elem.checked) || (nodeName === "option" && !!elem.selected);
						},

						"selected": function (elem) {
							// Accessing this property makes selected-by-default
							// options in Safari work properly
							if (elem.parentNode) {
								elem.parentNode.selectedIndex;
							}

							return elem.selected === true;
						},

						"parent": function (elem) {
							return !Expr.pseudos["empty"](elem);
						},

						"empty": function (elem) {
							// http://www.w3.org/TR/selectors/#empty-pseudo
							// :empty is only affected by element nodes and content nodes(including text(3), cdata(4)),
							//   not comment, processing instructions, or others
							// Thanks to Diego Perini for the nodeName shortcut
							//   Greater than "@" means alpha characters (specifically not starting with "#" or "?")
							var nodeType;
							elem = elem.firstChild;
							while (elem) {
								if (elem.nodeName > "@" || (nodeType = elem.nodeType) === 3 || nodeType === 4) {
									return false;
								}
								elem = elem.nextSibling;
							}
							return true;
						},

						"header": function (elem) {
							return rheader.test(elem.nodeName);
						},

						"text": function (elem) {
							var type, attr;
							// IE6 and 7 will map elem.type to 'text' for new HTML5 types (search, etc)
							// use getAttribute instead to test this case
							return elem.nodeName.toLowerCase() === "input" &&
								(type = elem.type) === "text" &&
								((attr = elem.getAttribute("type")) == null || attr.toLowerCase() === type);
						},

						// Input types
						"radio": createInputPseudo("radio"),
						"checkbox": createInputPseudo("checkbox"),
						"file": createInputPseudo("file"),
						"password": createInputPseudo("password"),
						"image": createInputPseudo("image"),

						"submit": createButtonPseudo("submit"),
						"reset": createButtonPseudo("reset"),

						"button": function (elem) {
							var name = elem.nodeName.toLowerCase();
							return name === "input" && elem.type === "button" || name === "button";
						},

						"input": function (elem) {
							return rinputs.test(elem.nodeName);
						},

						"focus": function (elem) {
							var doc = elem.ownerDocument;
							return elem === doc.activeElement && (!doc.hasFocus || doc.hasFocus()) && !!(elem.type || elem.href || ~elem.tabIndex);
						},

						"active": function (elem) {
							return elem === elem.ownerDocument.activeElement;
						},

						// Positional types
						"first": createPositionalPseudo(function () {
							return [0];
						}),

						"last": createPositionalPseudo(function (matchIndexes, length) {
							return [length - 1];
						}),

						"eq": createPositionalPseudo(function (matchIndexes, length, argument) {
							return [argument < 0 ? argument + length : argument];
						}),

						"even": createPositionalPseudo(function (matchIndexes, length) {
							for (var i = 0; i < length; i += 2) {
								matchIndexes.push(i);
							}
							return matchIndexes;
						}),

						"odd": createPositionalPseudo(function (matchIndexes, length) {
							for (var i = 1; i < length; i += 2) {
								matchIndexes.push(i);
							}
							return matchIndexes;
						}),

						"lt": createPositionalPseudo(function (matchIndexes, length, argument) {
							for (var i = argument < 0 ? argument + length : argument; --i >= 0;) {
								matchIndexes.push(i);
							}
							return matchIndexes;
						}),

						"gt": createPositionalPseudo(function (matchIndexes, length, argument) {
							for (var i = argument < 0 ? argument + length : argument; ++i < length;) {
								matchIndexes.push(i);
							}
							return matchIndexes;
						})
					}
				};

				function siblingCheck(a, b, ret) {
					if (a === b) {
						return ret;
					}

					var cur = a.nextSibling;

					while (cur) {
						if (cur === b) {
							return -1;
						}

						cur = cur.nextSibling;
					}

					return 1;
				}

				sortOrder = docElem.compareDocumentPosition ?
					function (a, b) {
						if (a === b) {
							hasDuplicate = true;
							return 0;
						}

						return (!a.compareDocumentPosition || !b.compareDocumentPosition ?
							a.compareDocumentPosition :
							a.compareDocumentPosition(b) & 4
						) ? -1 : 1;
					} :
					function (a, b) {
						// The nodes are identical, we can exit early
						if (a === b) {
							hasDuplicate = true;
							return 0;

							// Fallback to using sourceIndex (in IE) if it's available on both nodes
						} else if (a.sourceIndex && b.sourceIndex) {
							return a.sourceIndex - b.sourceIndex;
						}

						var al, bl,
							ap = [],
							bp = [],
							aup = a.parentNode,
							bup = b.parentNode,
							cur = aup;

						// If the nodes are siblings (or identical) we can do a quick check
						if (aup === bup) {
							return siblingCheck(a, b);

							// If no parents were found then the nodes are disconnected
						} else if (!aup) {
							return -1;

						} else if (!bup) {
							return 1;
						}

						// Otherwise they're somewhere else in the tree so we need
						// to build up a full list of the parentNodes for comparison
						while (cur) {
							ap.unshift(cur);
							cur = cur.parentNode;
						}

						cur = bup;

						while (cur) {
							bp.unshift(cur);
							cur = cur.parentNode;
						}

						al = ap.length;
						bl = bp.length;

						// Start walking down the tree looking for a discrepancy
						for (var i = 0; i < al && i < bl; i++) {
							if (ap[i] !== bp[i]) {
								return siblingCheck(ap[i], bp[i]);
							}
						}

						// We ended someplace up the tree so do a sibling check
						return i === al ?
							siblingCheck(a, bp[i], -1) :
							siblingCheck(ap[i], b, 1);
					};

				// Always assume the presence of duplicates if sort doesn't
				// pass them to our comparison function (as in Google Chrome).
				[0, 0].sort(sortOrder);
				baseHasDuplicate = !hasDuplicate;

				// Document sorting and removing duplicates
				Sizzle.uniqueSort = function (results) {
					var elem,
						duplicates = [],
						i = 1,
						j = 0;

					hasDuplicate = baseHasDuplicate;
					results.sort(sortOrder);

					if (hasDuplicate) {
						for (; (elem = results[i]); i++) {
							if (elem === results[i - 1]) {
								j = duplicates.push(i);
							}
						}
						while (j--) {
							results.splice(duplicates[j], 1);
						}
					}

					return results;
				};

				Sizzle.error = function (msg) {
					throw new Error("Syntax error, unrecognized expression: " + msg);
				};

				function tokenize(selector, parseOnly) {
					var matched, match, tokens, type,
						soFar, groups, preFilters,
						cached = tokenCache[expando][selector + " "];

					if (cached) {
						return parseOnly ? 0 : cached.slice(0);
					}

					soFar = selector;
					groups = [];
					preFilters = Expr.preFilter;

					while (soFar) {

						// Comma and first run
						if (!matched || (match = rcomma.exec(soFar))) {
							if (match) {
								// Don't consume trailing commas as valid
								soFar = soFar.slice(match[0].length) || soFar;
							}
							groups.push(tokens = []);
						}

						matched = false;

						// Combinators
						if ((match = rcombinators.exec(soFar))) {
							tokens.push(matched = new Token(match.shift()));
							soFar = soFar.slice(matched.length);

							// Cast descendant combinators to space
							matched.type = match[0].replace(rtrim, " ");
						}

						// Filters
						for (type in Expr.filter) {
							if ((match = matchExpr[type].exec(soFar)) && (!preFilters[type] ||
								(match = preFilters[type](match)))) {

								tokens.push(matched = new Token(match.shift()));
								soFar = soFar.slice(matched.length);
								matched.type = type;
								matched.matches = match;
							}
						}

						if (!matched) {
							break;
						}
					}

					// Return the length of the invalid excess
					// if we're just parsing
					// Otherwise, throw an error or return tokens
					return parseOnly ?
						soFar.length :
						soFar ?
							Sizzle.error(selector) :
							// Cache the tokens
							tokenCache(selector, groups).slice(0);
				}

				function addCombinator(matcher, combinator, base) {
					var dir = combinator.dir,
						checkNonElements = base && combinator.dir === "parentNode",
						doneName = done++;

					return combinator.first ?
						// Check against closest ancestor/preceding element
						function (elem, context, xml) {
							while ((elem = elem[dir])) {
								if (checkNonElements || elem.nodeType === 1) {
									return matcher(elem, context, xml);
								}
							}
						} :

						// Check against all ancestor/preceding elements
						function (elem, context, xml) {
							// We can't set arbitrary data on XML nodes, so they don't benefit from dir caching
							if (!xml) {
								var cache,
									dirkey = dirruns + " " + doneName + " ",
									cachedkey = dirkey + cachedruns;
								while ((elem = elem[dir])) {
									if (checkNonElements || elem.nodeType === 1) {
										if ((cache = elem[expando]) === cachedkey) {
											return elem.sizset;
										} else if (typeof cache === "string" && cache.indexOf(dirkey) === 0) {
											if (elem.sizset) {
												return elem;
											}
										} else {
											elem[expando] = cachedkey;
											if (matcher(elem, context, xml)) {
												elem.sizset = true;
												return elem;
											}
											elem.sizset = false;
										}
									}
								}
							} else {
								while ((elem = elem[dir])) {
									if (checkNonElements || elem.nodeType === 1) {
										if (matcher(elem, context, xml)) {
											return elem;
										}
									}
								}
							}
						};
				}

				function elementMatcher(matchers) {
					return matchers.length > 1 ?
						function (elem, context, xml) {
							var i = matchers.length;
							while (i--) {
								if (!matchers[i](elem, context, xml)) {
									return false;
								}
							}
							return true;
						} :
						matchers[0];
				}

				function condense(unmatched, map, filter, context, xml) {
					var elem,
						newUnmatched = [],
						i = 0,
						len = unmatched.length,
						mapped = map != null;

					for (; i < len; i++) {
						if ((elem = unmatched[i])) {
							if (!filter || filter(elem, context, xml)) {
								newUnmatched.push(elem);
								if (mapped) {
									map.push(i);
								}
							}
						}
					}

					return newUnmatched;
				}

				function setMatcher(preFilter, selector, matcher, postFilter, postFinder, postSelector) {
					if (postFilter && !postFilter[expando]) {
						postFilter = setMatcher(postFilter);
					}
					if (postFinder && !postFinder[expando]) {
						postFinder = setMatcher(postFinder, postSelector);
					}
					return markFunction(function (seed, results, context, xml) {
						var temp, i, elem,
							preMap = [],
							postMap = [],
							preexisting = results.length,

							// Get initial elements from seed or context
							elems = seed || multipleContexts(selector || "*", context.nodeType ? [context] : context, []),

							// Prefilter to get matcher input, preserving a map for seed-results synchronization
							matcherIn = preFilter && (seed || !selector) ?
								condense(elems, preMap, preFilter, context, xml) :
								elems,

							matcherOut = matcher ?
								// If we have a postFinder, or filtered seed, or non-seed postFilter or preexisting results,
								postFinder || (seed ? preFilter : preexisting || postFilter) ?

									// ...intermediate processing is necessary
									[] :

									// ...otherwise use results directly
									results :
								matcherIn;

						// Find primary matches
						if (matcher) {
							matcher(matcherIn, matcherOut, context, xml);
						}

						// Apply postFilter
						if (postFilter) {
							temp = condense(matcherOut, postMap);
							postFilter(temp, [], context, xml);

							// Un-match failing elements by moving them back to matcherIn
							i = temp.length;
							while (i--) {
								if ((elem = temp[i])) {
									matcherOut[postMap[i]] = !(matcherIn[postMap[i]] = elem);
								}
							}
						}

						if (seed) {
							if (postFinder || preFilter) {
								if (postFinder) {
									// Get the final matcherOut by condensing this intermediate into postFinder contexts
									temp = [];
									i = matcherOut.length;
									while (i--) {
										if ((elem = matcherOut[i])) {
											// Restore matcherIn since elem is not yet a final match
											temp.push((matcherIn[i] = elem));
										}
									}
									postFinder(null, (matcherOut = []), temp, xml);
								}

								// Move matched elements from seed to results to keep them synchronized
								i = matcherOut.length;
								while (i--) {
									if ((elem = matcherOut[i]) &&
										(temp = postFinder ? indexOf.call(seed, elem) : preMap[i]) > -1) {

										seed[temp] = !(results[temp] = elem);
									}
								}
							}

							// Add elements to results, through postFinder if defined
						} else {
							matcherOut = condense(
								matcherOut === results ?
									matcherOut.splice(preexisting, matcherOut.length) :
									matcherOut
							);
							if (postFinder) {
								postFinder(null, results, matcherOut, xml);
							} else {
								push.apply(results, matcherOut);
							}
						}
					});
				}

				function matcherFromTokens(tokens) {
					var checkContext, matcher, j,
						len = tokens.length,
						leadingRelative = Expr.relative[tokens[0].type],
						implicitRelative = leadingRelative || Expr.relative[" "],
						i = leadingRelative ? 1 : 0,

						// The foundational matcher ensures that elements are reachable from top-level context(s)
						matchContext = addCombinator(function (elem) {
							return elem === checkContext;
						}, implicitRelative, true),
						matchAnyContext = addCombinator(function (elem) {
							return indexOf.call(checkContext, elem) > -1;
						}, implicitRelative, true),
						matchers = [function (elem, context, xml) {
							return (!leadingRelative && (xml || context !== outermostContext)) || (
								(checkContext = context).nodeType ?
									matchContext(elem, context, xml) :
									matchAnyContext(elem, context, xml));
						}];

					for (; i < len; i++) {
						if ((matcher = Expr.relative[tokens[i].type])) {
							matchers = [addCombinator(elementMatcher(matchers), matcher)];
						} else {
							matcher = Expr.filter[tokens[i].type].apply(null, tokens[i].matches);

							// Return special upon seeing a positional matcher
							if (matcher[expando]) {
								// Find the next relative operator (if any) for proper handling
								j = ++i;
								for (; j < len; j++) {
									if (Expr.relative[tokens[j].type]) {
										break;
									}
								}
								return setMatcher(
									i > 1 && elementMatcher(matchers),
									i > 1 && tokens.slice(0, i - 1).join("").replace(rtrim, "$1"),
									matcher,
									i < j && matcherFromTokens(tokens.slice(i, j)),
									j < len && matcherFromTokens((tokens = tokens.slice(j))),
									j < len && tokens.join("")
								);
							}
							matchers.push(matcher);
						}
					}

					return elementMatcher(matchers);
				}

				function matcherFromGroupMatchers(elementMatchers, setMatchers) {
					var bySet = setMatchers.length > 0,
						byElement = elementMatchers.length > 0,
						superMatcher = function (seed, context, xml, results, expandContext) {
							var elem, j, matcher,
								setMatched = [],
								matchedCount = 0,
								i = "0",
								unmatched = seed && [],
								outermost = expandContext != null,
								contextBackup = outermostContext,
								// We must always have either seed elements or context
								elems = seed || byElement && Expr.find["TAG"]("*", expandContext && context.parentNode || context),
								// Nested matchers should use non-integer dirruns
								dirrunsUnique = (dirruns += contextBackup == null ? 1 : Math.E);

							if (outermost) {
								outermostContext = context !== document && context;
								cachedruns = superMatcher.el;
							}

							// Add elements passing elementMatchers directly to results
							for (; (elem = elems[i]) != null; i++) {
								if (byElement && elem) {
									for (j = 0; (matcher = elementMatchers[j]); j++) {
										if (matcher(elem, context, xml)) {
											results.push(elem);
											break;
										}
									}
									if (outermost) {
										dirruns = dirrunsUnique;
										cachedruns = ++superMatcher.el;
									}
								}

								// Track unmatched elements for set filters
								if (bySet) {
									// They will have gone through all possible matchers
									if ((elem = !matcher && elem)) {
										matchedCount--;
									}

									// Lengthen the array for every element, matched or not
									if (seed) {
										unmatched.push(elem);
									}
								}
							}

							// Apply set filters to unmatched elements
							matchedCount += i;
							if (bySet && i !== matchedCount) {
								for (j = 0; (matcher = setMatchers[j]); j++) {
									matcher(unmatched, setMatched, context, xml);
								}

								if (seed) {
									// Reintegrate element matches to eliminate the need for sorting
									if (matchedCount > 0) {
										while (i--) {
											if (!(unmatched[i] || setMatched[i])) {
												setMatched[i] = pop.call(results);
											}
										}
									}

									// Discard index placeholder values to get only actual matches
									setMatched = condense(setMatched);
								}

								// Add matches to results
								push.apply(results, setMatched);

								// Seedless set matches succeeding multiple successful matchers stipulate sorting
								if (outermost && !seed && setMatched.length > 0 &&
									(matchedCount + setMatchers.length) > 1) {

									Sizzle.uniqueSort(results);
								}
							}

							// Override manipulation of globals by nested matchers
							if (outermost) {
								dirruns = dirrunsUnique;
								outermostContext = contextBackup;
							}

							return unmatched;
						};

					superMatcher.el = 0;
					return bySet ?
						markFunction(superMatcher) :
						superMatcher;
				}

				compile = Sizzle.compile = function (selector, group /* Internal Use Only */) {
					var i,
						setMatchers = [],
						elementMatchers = [],
						cached = compilerCache[expando][selector + " "];

					if (!cached) {
						// Generate a function of recursive functions that can be used to check each element
						if (!group) {
							group = tokenize(selector);
						}
						i = group.length;
						while (i--) {
							cached = matcherFromTokens(group[i]);
							if (cached[expando]) {
								setMatchers.push(cached);
							} else {
								elementMatchers.push(cached);
							}
						}

						// Cache the compiled function
						cached = compilerCache(selector, matcherFromGroupMatchers(elementMatchers, setMatchers));
					}
					return cached;
				};

				function multipleContexts(selector, contexts, results) {
					var i = 0,
						len = contexts.length;
					for (; i < len; i++) {
						Sizzle(selector, contexts[i], results);
					}
					return results;
				}

				function select(selector, context, results, seed, xml) {
					var i, tokens, token, type, find,
						match = tokenize(selector),
						j = match.length;

					if (!seed) {
						// Try to minimize operations if there is only one group
						if (match.length === 1) {

							// Take a shortcut and set the context if the root selector is an ID
							tokens = match[0] = match[0].slice(0);
							if (tokens.length > 2 && (token = tokens[0]).type === "ID" &&
								context.nodeType === 9 && !xml &&
								Expr.relative[tokens[1].type]) {

								context = Expr.find["ID"](token.matches[0].replace(rbackslash, ""), context, xml)[0];
								if (!context) {
									return results;
								}

								selector = selector.slice(tokens.shift().length);
							}

							// Fetch a seed set for right-to-left matching
							for (i = matchExpr["POS"].test(selector) ? -1 : tokens.length - 1; i >= 0; i--) {
								token = tokens[i];

								// Abort if we hit a combinator
								if (Expr.relative[(type = token.type)]) {
									break;
								}
								if ((find = Expr.find[type])) {
									// Search, expanding context for leading sibling combinators
									if ((seed = find(
										token.matches[0].replace(rbackslash, ""),
										rsibling.test(tokens[0].type) && context.parentNode || context,
										xml
									))) {

										// If seed is empty or no tokens remain, we can return early
										tokens.splice(i, 1);
										selector = seed.length && tokens.join("");
										if (!selector) {
											push.apply(results, slice.call(seed, 0));
											return results;
										}

										break;
									}
								}
							}
						}
					}

					// Compile and execute a filtering function
					// Provide `match` to avoid retokenization if we modified the selector above
					compile(selector, match)(
						seed,
						context,
						xml,
						results,
						rsibling.test(selector)
					);
					return results;
				}

				if (document.querySelectorAll) {
					(function () {
						var disconnectedMatch,
							oldSelect = select,
							rescape = /'|\\/g,
							rattributeQuotes = /\=[\x20\t\r\n\f]*([^'"\]]*)[\x20\t\r\n\f]*\]/g,

							// qSa(:focus) reports false when true (Chrome 21), no need to also add to buggyMatches since matches checks buggyQSA
							// A support test would require too much code (would include document ready)
							rbuggyQSA = [":focus"],

							// matchesSelector(:active) reports false when true (IE9/Opera 11.5)
							// A support test would require too much code (would include document ready)
							// just skip matchesSelector for :active
							rbuggyMatches = [":active"],
							matches = docElem.matchesSelector ||
								docElem.mozMatchesSelector ||
								docElem.webkitMatchesSelector ||
								docElem.oMatchesSelector ||
								docElem.msMatchesSelector;

						// Build QSA regex
						// Regex strategy adopted from Diego Perini
						assert(function (div) {
							// Select is set to empty string on purpose
							// This is to test IE's treatment of not explictly
							// setting a boolean content attribute,
							// since its presence should be enough
							// http://bugs.jqx.com/ticket/12359
							div.innerHTML = "<select><option selected=''></option></select>";

							// IE8 - Some boolean attributes are not treated correctly
							if (!div.querySelectorAll("[selected]").length) {
								rbuggyQSA.push("\\[" + whitespace + "*(?:checked|disabled|ismap|multiple|readonly|selected|value)");
							}

							// Webkit/Opera - :checked should return selected option elements
							// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
							// IE8 throws error here (do not put tests after this one)
							if (!div.querySelectorAll(":checked").length) {
								rbuggyQSA.push(":checked");
							}
						});

						assert(function (div) {

							// Opera 10-12/IE9 - ^= $= *= and empty values
							// Should not select anything
							div.innerHTML = "<p test=''></p>";
							if (div.querySelectorAll("[test^='']").length) {
								rbuggyQSA.push("[*^$]=" + whitespace + "*(?:\"\"|'')");
							}

							// FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
							// IE8 throws error here (do not put tests after this one)
							div.innerHTML = "<input type='hidden'/>";
							if (!div.querySelectorAll(":enabled").length) {
								rbuggyQSA.push(":enabled", ":disabled");
							}
						});

						// rbuggyQSA always contains :focus, so no need for a length check
						rbuggyQSA = /* rbuggyQSA.length && */ new RegExp(rbuggyQSA.join("|"));

						select = function (selector, context, results, seed, xml) {
							// Only use querySelectorAll when not filtering,
							// when this is not xml,
							// and when no QSA bugs apply
							if (!seed && !xml && !rbuggyQSA.test(selector)) {
								var groups, i,
									old = true,
									nid = expando,
									newContext = context,
									newSelector = context.nodeType === 9 && selector;

								// qSA works strangely on Element-rooted queries
								// We can work around this by specifying an extra ID on the root
								// and working up from there (Thanks to Andrew Dupont for the technique)
								// IE 8 doesn't work on object elements
								if (context.nodeType === 1 && context.nodeName.toLowerCase() !== "object") {
									groups = tokenize(selector);

									if ((old = context.getAttribute("id"))) {
										nid = old.replace(rescape, "\\$&");
									} else {
										context.setAttribute("id", nid);
									}
									nid = "[id='" + nid + "'] ";

									i = groups.length;
									while (i--) {
										groups[i] = nid + groups[i].join("");
									}
									newContext = rsibling.test(selector) && context.parentNode || context;
									newSelector = groups.join(",");
								}

								if (newSelector) {
									try {
										push.apply(results, slice.call(newContext.querySelectorAll(
											newSelector
										), 0));
										return results;
									} catch (qsaError) {
									} finally {
										if (!old) {
											context.removeAttribute("id");
										}
									}
								}
							}

							return oldSelect(selector, context, results, seed, xml);
						};

						if (matches) {
							assert(function (div) {
								// Check to see if it's possible to do matchesSelector
								// on a disconnected node (IE 9)
								disconnectedMatch = matches.call(div, "div");

								// This should fail with an exception
								// Gecko does not error, returns false instead
								try {
									matches.call(div, "[test!='']:sizzle");
									rbuggyMatches.push("!=", pseudos);
								} catch (e) { }
							});

							// rbuggyMatches always contains :active and :focus, so no need for a length check
							rbuggyMatches = /* rbuggyMatches.length && */ new RegExp(rbuggyMatches.join("|"));

							Sizzle.matchesSelector = function (elem, expr) {
								// Make sure that attribute selectors are quoted
								expr = expr.replace(rattributeQuotes, "='$1']");

								// rbuggyMatches always contains :active, so no need for an existence check
								if (!isXML(elem) && !rbuggyMatches.test(expr) && !rbuggyQSA.test(expr)) {
									try {
										var ret = matches.call(elem, expr);

										// IE 9's matchesSelector returns false on disconnected nodes
										if (ret || disconnectedMatch ||
											// As well, disconnected nodes are said to be in a document
											// fragment in IE 9
											elem.document && elem.document.nodeType !== 11) {
											return ret;
										}
									} catch (e) { }
								}

								return Sizzle(expr, null, null, [elem]).length > 0;
							};
						}
					})();
				}

				// Deprecated
				Expr.pseudos["nth"] = Expr.pseudos["eq"];

				// Back-compat
				function setFilters() { }
				Expr.filters = setFilters.prototype = Expr.pseudos;
				Expr.setFilters = new setFilters();

				// Override sizzle attribute retrieval
				Sizzle.attr = JQXLite.attr;
				JQXLite.find = Sizzle;
				JQXLite.expr = Sizzle.selectors;
				JQXLite.expr[":"] = JQXLite.expr.pseudos;
				JQXLite.unique = Sizzle.uniqueSort;
				JQXLite.text = Sizzle.getText;
				JQXLite.isXMLDoc = Sizzle.isXML;
				JQXLite.contains = Sizzle.contains;


			})(window);
			var runtil = /Until$/,
				rparentsprev = /^(?:parents|prev(?:Until|All))/,
				isSimple = /^.[^:#\[\.,]*$/,
				rneedsContext = JQXLite.expr.match.needsContext,
				// methods guaranteed to produce a unique set when starting from a unique set
				guaranteedUnique = {
					children: true,
					contents: true,
					next: true,
					prev: true
				};

			JQXLite.fn.extend({
				find: function (selector) {
					var i, l, length, n, r, ret,
						self = this;

					if (typeof selector !== "string") {
						return JQXLite(selector).filter(function () {
							for (i = 0, l = self.length; i < l; i++) {
								if (JQXLite.contains(self[i], this)) {
									return true;
								}
							}
						});
					}

					ret = this.pushStack("", "find", selector);

					for (i = 0, l = this.length; i < l; i++) {
						length = ret.length;
						JQXLite.find(selector, this[i], ret);

						if (i > 0) {
							// Make sure that the results are unique
							for (n = length; n < ret.length; n++) {
								for (r = 0; r < length; r++) {
									if (ret[r] === ret[n]) {
										ret.splice(n--, 1);
										break;
									}
								}
							}
						}
					}

					return ret;
				},

				has: function (target) {
					var i,
						targets = JQXLite(target, this),
						len = targets.length;

					return this.filter(function () {
						for (i = 0; i < len; i++) {
							if (JQXLite.contains(this, targets[i])) {
								return true;
							}
						}
					});
				},

				not: function (selector) {
					return this.pushStack(winnow(this, selector, false), "not", selector);
				},

				filter: function (selector) {
					return this.pushStack(winnow(this, selector, true), "filter", selector);
				},

				is: function (selector) {
					return !!selector && (
						typeof selector === "string" ?
							// If this is a positional/relative selector, check membership in the returned set
							// so $("p:first").is("p:last") won't return true for a doc with two "p".
							rneedsContext.test(selector) ?
								JQXLite(selector, this.context).index(this[0]) >= 0 :
								JQXLite.filter(selector, this).length > 0 :
							this.filter(selector).length > 0);
				},

				closest: function (selectors, context) {
					var cur,
						i = 0,
						l = this.length,
						ret = [],
						pos = rneedsContext.test(selectors) || typeof selectors !== "string" ?
							JQXLite(selectors, context || this.context) :
							0;

					for (; i < l; i++) {
						cur = this[i];

						while (cur && cur.ownerDocument && cur !== context && cur.nodeType !== 11) {
							if (pos ? pos.index(cur) > -1 : JQXLite.find.matchesSelector(cur, selectors)) {
								ret.push(cur);
								break;
							}
							cur = cur.parentNode;
						}
					}

					ret = ret.length > 1 ? JQXLite.unique(ret) : ret;

					return this.pushStack(ret, "closest", selectors);
				},

				// Determine the position of an element within
				// the matched set of elements
				index: function (elem) {

					// No argument, return index in parent
					if (!elem) {
						return (this[0] && this[0].parentNode) ? this.prevAll().length : -1;
					}

					// index in selector
					if (typeof elem === "string") {
						return JQXLite.inArray(this[0], JQXLite(elem));
					}

					// Locate the position of the desired element
					return JQXLite.inArray(
						// If it receives a JQXLite object, the first element is used
						elem.jqx ? elem[0] : elem, this);
				},

				add: function (selector, context) {
					var set = typeof selector === "string" ?
						JQXLite(selector, context) :
						JQXLite.makeArray(selector && selector.nodeType ? [selector] : selector),
						all = JQXLite.merge(this.get(), set);

					return this.pushStack(isDisconnected(set[0]) || isDisconnected(all[0]) ?
						all :
						JQXLite.unique(all));
				},

				addBack: function (selector) {
					return this.add(selector == null ?
						this.prevObject : this.prevObject.filter(selector)
					);
				}
			});

			JQXLite.fn.andSelf = JQXLite.fn.addBack;

			// A painfully simple check to see if an element is disconnected
			// from a document (should be improved, where feasible).
			function isDisconnected(node) {
				return !node || !node.parentNode || node.parentNode.nodeType === 11;
			}

			function sibling(cur, dir) {
				do {
					cur = cur[dir];
				} while (cur && cur.nodeType !== 1);

				return cur;
			}

			JQXLite.each({
				parent: function (elem) {
					var parent = elem.parentNode;
					return parent && parent.nodeType !== 11 ? parent : null;
				},
				parents: function (elem) {
					return JQXLite.dir(elem, "parentNode");
				},
				parentsUntil: function (elem, i, until) {
					return JQXLite.dir(elem, "parentNode", until);
				},
				next: function (elem) {
					return sibling(elem, "nextSibling");
				},
				prev: function (elem) {
					return sibling(elem, "previousSibling");
				},
				nextAll: function (elem) {
					return JQXLite.dir(elem, "nextSibling");
				},
				prevAll: function (elem) {
					return JQXLite.dir(elem, "previousSibling");
				},
				nextUntil: function (elem, i, until) {
					return JQXLite.dir(elem, "nextSibling", until);
				},
				prevUntil: function (elem, i, until) {
					return JQXLite.dir(elem, "previousSibling", until);
				},
				siblings: function (elem) {
					return JQXLite.sibling((elem.parentNode || {}).firstChild, elem);
				},
				children: function (elem) {
					return JQXLite.sibling(elem.firstChild);
				},
				contents: function (elem) {
					return JQXLite.nodeName(elem, "iframe") ?
						elem.contentDocument || elem.contentWindow.document :
						JQXLite.merge([], elem.childNodes);
				}
			}, function (name, fn) {
				JQXLite.fn[name] = function (until, selector) {
					var ret = JQXLite.map(this, fn, until);

					if (!runtil.test(name)) {
						selector = until;
					}

					if (selector && typeof selector === "string") {
						ret = JQXLite.filter(selector, ret);
					}

					ret = this.length > 1 && !guaranteedUnique[name] ? JQXLite.unique(ret) : ret;

					if (this.length > 1 && rparentsprev.test(name)) {
						ret = ret.reverse();
					}

					return this.pushStack(ret, name, core_slice.call(arguments).join(","));
				};
			});

			JQXLite.extend({
				filter: function (expr, elems, not) {
					if (not) {
						expr = ":not(" + expr + ")";
					}

					return elems.length === 1 ?
						JQXLite.find.matchesSelector(elems[0], expr) ? [elems[0]] : [] :
						JQXLite.find.matches(expr, elems);
				},

				dir: function (elem, dir, until) {
					var matched = [],
						cur = elem[dir];

					while (cur && cur.nodeType !== 9 && (until === undefined || cur.nodeType !== 1 || !JQXLite(cur).is(until))) {
						if (cur.nodeType === 1) {
							matched.push(cur);
						}
						cur = cur[dir];
					}
					return matched;
				},

				sibling: function (n, elem) {
					var r = [];

					for (; n; n = n.nextSibling) {
						if (n.nodeType === 1 && n !== elem) {
							r.push(n);
						}
					}

					return r;
				}
			});

			// Implement the identical functionality for filter and not
			function winnow(elements, qualifier, keep) {

				// Can't pass null or undefined to indexOf in Firefox 4
				// Set to 0 to skip string check
				qualifier = qualifier || 0;

				if (JQXLite.isFunction(qualifier)) {
					return JQXLite.grep(elements, function (elem, i) {
						var retVal = !!qualifier.call(elem, i, elem);
						return retVal === keep;
					});

				} else if (qualifier.nodeType) {
					return JQXLite.grep(elements, function (elem, i) {
						return (elem === qualifier) === keep;
					});

				} else if (typeof qualifier === "string") {
					var filtered = JQXLite.grep(elements, function (elem) {
						return elem.nodeType === 1;
					});

					if (isSimple.test(qualifier)) {
						return JQXLite.filter(qualifier, filtered, !keep);
					} else {
						qualifier = JQXLite.filter(qualifier, filtered);
					}
				}

				return JQXLite.grep(elements, function (elem, i) {
					return (JQXLite.inArray(elem, qualifier) >= 0) === keep;
				});
			}
			function createSafeFragment(document) {
				var list = nodeNames.split("|"),
					safeFrag = document.createDocumentFragment();

				if (safeFrag.createElement) {
					while (list.length) {
						safeFrag.createElement(
							list.pop()
						);
					}
				}
				return safeFrag;
			}

			var nodeNames = "abbr|article|aside|audio|bdi|canvas|data|datalist|details|figcaption|figure|footer|" +
				"header|hgroup|mark|meter|nav|output|progress|section|summary|time|video",
				rinlinejQuery = / JQXLite\d+="(?:null|\d+)"/g,
				rleadingWhitespace = /^\s+/,
				rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,
				rtagName = /<([\w:]+)/,
				rtbody = /<tbody/i,
				rhtml = /<|&#?\w+;/,
				rnoInnerhtml = /<(?:script|style|link)/i,
				rnocache = /<(?:script|object|embed|option|style)/i,
				rnoshimcache = new RegExp("<(?:" + nodeNames + ")[\\s/>]", "i"),
				rcheckableType = /^(?:checkbox|radio)$/,
				// checked="checked" or checked
				rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,
				rscriptType = /\/(java|ecma)script/i,
				rcleanScript = /^\s*<!(?:\[CDATA\[|\-\-)|[\]\-]{2}>\s*$/g,
				wrapMap = {
					option: [1, "<select multiple='multiple'>", "</select>"],
					legend: [1, "<fieldset>", "</fieldset>"],
					thead: [1, "<table>", "</table>"],
					tr: [2, "<table><tbody>", "</tbody></table>"],
					td: [3, "<table><tbody><tr>", "</tr></tbody></table>"],
					col: [2, "<table><tbody></tbody><colgroup>", "</colgroup></table>"],
					area: [1, "<map>", "</map>"],
					_default: [0, "", ""]
				},
				safeFragment = createSafeFragment(document),
				fragmentDiv = safeFragment.appendChild(document.createElement("div"));

			wrapMap.optgroup = wrapMap.option;
			wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
			wrapMap.th = wrapMap.td;

			// IE6-8 can't serialize link, script, style, or any html5 (NoScope) tags,
			// unless wrapped in a div with non-breaking characters in front of it.
			if (!JQXLite.support.htmlSerialize) {
				wrapMap._default = [1, "X<div>", "</div>"];
			}

			JQXLite.fn.extend({
				text: function (value) {
					return JQXLite.access(this, function (value) {
						return value === undefined ?
							JQXLite.text(this) :
							this.empty().append((this[0] && this[0].ownerDocument || document).createTextNode(value));
					}, null, value, arguments.length);
				},

				wrapAll: function (html) {
					if (JQXLite.isFunction(html)) {
						return this.each(function (i) {
							JQXLite(this).wrapAll(html.call(this, i));
						});
					}

					if (this[0]) {
						// The elements to wrap the target around
						var wrap = JQXLite(html, this[0].ownerDocument).eq(0).clone(true);

						if (this[0].parentNode) {
							wrap.insertBefore(this[0]);
						}

						wrap.map(function () {
							var elem = this;

							while (elem.firstChild && elem.firstChild.nodeType === 1) {
								elem = elem.firstChild;
							}

							return elem;
						}).append(this);
					}

					return this;
				},

				wrapInner: function (html) {
					if (JQXLite.isFunction(html)) {
						return this.each(function (i) {
							JQXLite(this).wrapInner(html.call(this, i));
						});
					}

					return this.each(function () {
						var self = JQXLite(this),
							contents = self.contents();

						if (contents.length) {
							contents.wrapAll(html);

						} else {
							self.append(html);
						}
					});
				},

				wrap: function (html) {
					var isFunction = JQXLite.isFunction(html);

					return this.each(function (i) {
						JQXLite(this).wrapAll(isFunction ? html.call(this, i) : html);
					});
				},

				unwrap: function () {
					return this.parent().each(function () {
						if (!JQXLite.nodeName(this, "body")) {
							JQXLite(this).replaceWith(this.childNodes);
						}
					}).end();
				},

				append: function () {
					return this.domManip(arguments, true, function (elem) {
						if (this.nodeType === 1 || this.nodeType === 11) {
							this.appendChild(elem);
						}
					});
				},

				prepend: function () {
					return this.domManip(arguments, true, function (elem) {
						if (this.nodeType === 1 || this.nodeType === 11) {
							this.insertBefore(elem, this.firstChild);
						}
					});
				},

				before: function () {
					if (!isDisconnected(this[0])) {
						return this.domManip(arguments, false, function (elem) {
							this.parentNode.insertBefore(elem, this);
						});
					}

					if (arguments.length) {
						var set = JQXLite.clean(arguments);
						return this.pushStack(JQXLite.merge(set, this), "before", this.selector);
					}
				},

				after: function () {
					if (!isDisconnected(this[0])) {
						return this.domManip(arguments, false, function (elem) {
							this.parentNode.insertBefore(elem, this.nextSibling);
						});
					}

					if (arguments.length) {
						var set = JQXLite.clean(arguments);
						return this.pushStack(JQXLite.merge(this, set), "after", this.selector);
					}
				},

				// keepData is for internal use only--do not document
				remove: function (selector, keepData) {
					var elem,
						i = 0;

					for (; (elem = this[i]) != null; i++) {
						if (!selector || JQXLite.filter(selector, [elem]).length) {
							if (!keepData && elem.nodeType === 1) {
								JQXLite.cleanData(elem.getElementsByTagName("*"));
								JQXLite.cleanData([elem]);
							}

							if (elem.parentNode) {
								elem.parentNode.removeChild(elem);
							}
						}
					}

					return this;
				},

				empty: function () {
					var elem,
						i = 0;

					for (; (elem = this[i]) != null; i++) {
						// Remove element nodes and prevent memory leaks
						if (elem.nodeType === 1) {
							JQXLite.cleanData(elem.getElementsByTagName("*"));
						}

						// Remove any remaining nodes
						while (elem.firstChild) {
							elem.removeChild(elem.firstChild);
						}
					}

					return this;
				},

				clone: function (dataAndEvents, deepDataAndEvents) {
					dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
					deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

					return this.map(function () {
						return JQXLite.clone(this, dataAndEvents, deepDataAndEvents);
					});
				},

				html: function (value) {
					return JQXLite.access(this, function (value) {
						var elem = this[0] || {},
							i = 0,
							l = this.length;

						if (value === undefined) {
							return elem.nodeType === 1 ?
								elem.innerHTML.replace(rinlinejQuery, "") :
								undefined;
						}

						// See if we can take a shortcut and just use innerHTML
						if (typeof value === "string" && !rnoInnerhtml.test(value) &&
							(JQXLite.support.htmlSerialize || !rnoshimcache.test(value)) &&
							(JQXLite.support.leadingWhitespace || !rleadingWhitespace.test(value)) &&
							!wrapMap[(rtagName.exec(value) || ["", ""])[1].toLowerCase()]) {

							value = value.replace(rxhtmlTag, "<$1></$2>");

							try {
								for (; i < l; i++) {
									// Remove element nodes and prevent memory leaks
									elem = this[i] || {};
									if (elem.nodeType === 1) {
										JQXLite.cleanData(elem.getElementsByTagName("*"));
										elem.innerHTML = value;
									}
								}

								elem = 0;

								// If using innerHTML throws an exception, use the fallback method
							} catch (e) { }
						}

						if (elem) {
							this.empty().append(value);
						}
					}, null, value, arguments.length);
				},

				replaceWith: function (value) {
					if (!isDisconnected(this[0])) {
						// Make sure that the elements are removed from the DOM before they are inserted
						// this can help fix replacing a parent with child elements
						if (JQXLite.isFunction(value)) {
							return this.each(function (i) {
								var self = JQXLite(this), old = self.html();
								self.replaceWith(value.call(this, i, old));
							});
						}

						if (typeof value !== "string") {
							value = JQXLite(value).detach();
						}

						return this.each(function () {
							var next = this.nextSibling,
								parent = this.parentNode;

							JQXLite(this).remove();

							if (next) {
								JQXLite(next).before(value);
							} else {
								JQXLite(parent).append(value);
							}
						});
					}

					return this.length ?
						this.pushStack(JQXLite(JQXLite.isFunction(value) ? value() : value), "replaceWith", value) :
						this;
				},

				detach: function (selector) {
					return this.remove(selector, true);
				},

				domManip: function (args, table, callback) {

					// Flatten any nested arrays
					args = [].concat.apply([], args);

					var results, first, fragment, iNoClone,
						i = 0,
						value = args[0],
						scripts = [],
						l = this.length;

					// We can't cloneNode fragments that contain checked, in WebKit
					if (!JQXLite.support.checkClone && l > 1 && typeof value === "string" && rchecked.test(value)) {
						return this.each(function () {
							JQXLite(this).domManip(args, table, callback);
						});
					}

					if (JQXLite.isFunction(value)) {
						return this.each(function (i) {
							var self = JQXLite(this);
							args[0] = value.call(this, i, table ? self.html() : undefined);
							self.domManip(args, table, callback);
						});
					}

					if (this[0]) {
						results = JQXLite.buildFragment(args, this, scripts);
						fragment = results.fragment;
						first = fragment.firstChild;

						if (fragment.childNodes.length === 1) {
							fragment = first;
						}

						if (first) {
							table = table && JQXLite.nodeName(first, "tr");

							// Use the original fragment for the last item instead of the first because it can end up
							// being emptied incorrectly in certain situations (#8070).
							// Fragments from the fragment cache must always be cloned and never used in place.
							for (iNoClone = results.cacheable || l - 1; i < l; i++) {
								callback.call(
									table && JQXLite.nodeName(this[i], "table") ?
										findOrAppend(this[i], "tbody") :
										this[i],
									i === iNoClone ?
										fragment :
										JQXLite.clone(fragment, true, true)
								);
							}
						}

						// Fix #11809: Avoid leaking memory
						fragment = first = null;

						if (scripts.length) {
							JQXLite.each(scripts, function (i, elem) {
								if (elem.src) {
									if (JQXLite.ajax) {
										JQXLite.ajax({
											url: elem.src,
											type: "GET",
											dataType: "script",
											async: false,
											global: false,
											"throws": true
										});
									} else {
										JQXLite.error("no ajax");
									}
								} else {
									JQXLite.globalEval((elem.text || elem.textContent || elem.innerHTML || "").replace(rcleanScript, ""));
								}

								if (elem.parentNode) {
									elem.parentNode.removeChild(elem);
								}
							});
						}
					}

					return this;
				}
			});

			function findOrAppend(elem, tag) {
				return elem.getElementsByTagName(tag)[0] || elem.appendChild(elem.ownerDocument.createElement(tag));
			}

			function cloneCopyEvent(src, dest) {

				if (dest.nodeType !== 1 || !JQXLite.hasData(src)) {
					return;
				}

				var type, i, l,
					oldData = JQXLite._data(src),
					curData = JQXLite._data(dest, oldData),
					events = oldData.events;

				if (events) {
					delete curData.handle;
					curData.events = {};

					for (type in events) {
						for (i = 0, l = events[type].length; i < l; i++) {
							JQXLite.event.add(dest, type, events[type][i]);
						}
					}
				}

				// make the cloned public data object a copy from the original
				if (curData.data) {
					curData.data = JQXLite.extend({}, curData.data);
				}
			}

			function cloneFixAttributes(src, dest) {
				var nodeName;

				// We do not need to do anything for non-Elements
				if (dest.nodeType !== 1) {
					return;
				}

				// clearAttributes removes the attributes, which we don't want,
				// but also removes the attachEvent events, which we *do* want
				if (dest.clearAttributes) {
					dest.clearAttributes();
				}

				// mergeAttributes, in contrast, only merges back on the
				// original attributes, not the events
				if (dest.mergeAttributes) {
					dest.mergeAttributes(src);
				}

				nodeName = dest.nodeName.toLowerCase();

				if (nodeName === "object") {
					// IE6-10 improperly clones children of object elements using classid.
					// IE10 throws NoModificationAllowedError if parent is null, #12132.
					if (dest.parentNode) {
						dest.outerHTML = src.outerHTML;
					}

					// This path appears unavoidable for IE9. When cloning an object
					// element in IE9, the outerHTML strategy above is not sufficient.
					// If the src has innerHTML and the destination does not,
					// copy the src.innerHTML into the dest.innerHTML. #10324
					if (JQXLite.support.html5Clone && (src.innerHTML && !JQXLite.trim(dest.innerHTML))) {
						dest.innerHTML = src.innerHTML;
					}

				} else if (nodeName === "input" && rcheckableType.test(src.type)) {
					// IE6-8 fails to persist the checked state of a cloned checkbox
					// or radio button. Worse, IE6-7 fail to give the cloned element
					// a checked appearance if the defaultChecked value isn't also set

					dest.defaultChecked = dest.checked = src.checked;

					// IE6-7 get confused and end up setting the value of a cloned
					// checkbox/radio button to an empty string instead of "on"
					if (dest.value !== src.value) {
						dest.value = src.value;
					}

					// IE6-8 fails to return the selected option to the default selected
					// state when cloning options
				} else if (nodeName === "option") {
					dest.selected = src.defaultSelected;

					// IE6-8 fails to set the defaultValue to the correct value when
					// cloning other types of input fields
				} else if (nodeName === "input" || nodeName === "textarea") {
					dest.defaultValue = src.defaultValue;

					// IE blanks contents when cloning scripts
				} else if (nodeName === "script" && dest.text !== src.text) {
					dest.text = src.text;
				}

				// Event data gets referenced instead of copied if the expando
				// gets copied too
				dest.removeAttribute(JQXLite.expando);
			}

			JQXLite.buildFragment = function (args, context, scripts) {
				var fragment, cacheable, cachehit,
					first = args[0];

				// Set context from what may come in as undefined or a JQXLite collection or a node
				// Updated to fix #12266 where accessing context[0] could throw an exception in IE9/10 &
				// also doubles as fix for #8950 where plain objects caused createDocumentFragment exception
				context = context || document;
				context = !context.nodeType && context[0] || context;
				context = context.ownerDocument || context;

				// Only cache "small" (1/2 KB) HTML strings that are associated with the main document
				// Cloning options loses the selected state, so don't cache them
				// IE 6 doesn't like it when you put <object> or <embed> elements in a fragment
				// Also, WebKit does not clone 'checked' attributes on cloneNode, so don't cache
				// Lastly, IE6,7,8 will not correctly reuse cached fragments that were created from unknown elems #10501
				if (args.length === 1 && typeof first === "string" && first.length < 512 && context === document &&
					first.charAt(0) === "<" && !rnocache.test(first) &&
					(JQXLite.support.checkClone || !rchecked.test(first)) &&
					(JQXLite.support.html5Clone || !rnoshimcache.test(first))) {

					// Mark cacheable and look for a hit
					cacheable = true;
					fragment = JQXLite.fragments[first];
					cachehit = fragment !== undefined;
				}

				if (!fragment) {
					fragment = context.createDocumentFragment();
					JQXLite.clean(args, context, fragment, scripts);

					// Update the cache, but only store false
					// unless this is a second parsing of the same content
					if (cacheable) {
						JQXLite.fragments[first] = cachehit && fragment;
					}
				}

				return { fragment: fragment, cacheable: cacheable };
			};

			JQXLite.fragments = {};

			JQXLite.each({
				appendTo: "append",
				prependTo: "prepend",
				insertBefore: "before",
				insertAfter: "after",
				replaceAll: "replaceWith"
			}, function (name, original) {
				JQXLite.fn[name] = function (selector) {
					var elems,
						i = 0,
						ret = [],
						insert = JQXLite(selector),
						l = insert.length,
						parent = this.length === 1 && this[0].parentNode;

					if ((parent == null || parent && parent.nodeType === 11 && parent.childNodes.length === 1) && l === 1) {
						insert[original](this[0]);
						return this;
					} else {
						for (; i < l; i++) {
							elems = (i > 0 ? this.clone(true) : this).get();
							JQXLite(insert[i])[original](elems);
							ret = ret.concat(elems);
						}

						return this.pushStack(ret, name, insert.selector);
					}
				};
			});

			function getAll(elem) {
				if (typeof elem.getElementsByTagName !== "undefined") {
					return elem.getElementsByTagName("*");

				} else if (typeof elem.querySelectorAll !== "undefined") {
					return elem.querySelectorAll("*");

				} else {
					return [];
				}
			}

			// Used in clean, fixes the defaultChecked property
			function fixDefaultChecked(elem) {
				if (rcheckableType.test(elem.type)) {
					elem.defaultChecked = elem.checked;
				}
			}

			JQXLite.extend({
				clone: function (elem, dataAndEvents, deepDataAndEvents) {
					var srcElements,
						destElements,
						i,
						clone;

					if (JQXLite.support.html5Clone || JQXLite.isXMLDoc(elem) || !rnoshimcache.test("<" + elem.nodeName + ">")) {
						clone = elem.cloneNode(true);

						// IE<=8 does not properly clone detached, unknown element nodes
					} else {
						fragmentDiv.innerHTML = elem.outerHTML;
						fragmentDiv.removeChild(clone = fragmentDiv.firstChild);
					}

					if ((!JQXLite.support.noCloneEvent || !JQXLite.support.noCloneChecked) &&
						(elem.nodeType === 1 || elem.nodeType === 11) && !JQXLite.isXMLDoc(elem)) {
						// IE copies events bound via attachEvent when using cloneNode.
						// Calling detachEvent on the clone will also remove the events
						// from the original. In order to get around this, we use some
						// proprietary methods to clear the events. Thanks to MooTools
						// guys for this hotness.

						cloneFixAttributes(elem, clone);

						// Using Sizzle here is crazy slow, so we use getElementsByTagName instead
						srcElements = getAll(elem);
						destElements = getAll(clone);

						// Weird iteration because IE will replace the length property
						// with an element if you are cloning the body and one of the
						// elements on the page has a name or id of "length"
						for (i = 0; srcElements[i]; ++i) {
							// Ensure that the destination node is not null; Fixes #9587
							if (destElements[i]) {
								cloneFixAttributes(srcElements[i], destElements[i]);
							}
						}
					}

					// Copy the events from the original to the clone
					if (dataAndEvents) {
						cloneCopyEvent(elem, clone);

						if (deepDataAndEvents) {
							srcElements = getAll(elem);
							destElements = getAll(clone);

							for (i = 0; srcElements[i]; ++i) {
								cloneCopyEvent(srcElements[i], destElements[i]);
							}
						}
					}

					srcElements = destElements = null;

					// Return the cloned set
					return clone;
				},

				clean: function (elems, context, fragment, scripts) {
					var i, j, elem, tag, wrap, depth, div, hasBody, tbody, len, handleScript, jsTags,
						safe = context === document && safeFragment,
						ret = [];

					// Ensure that context is a document
					if (!context || typeof context.createDocumentFragment === "undefined") {
						context = document;
					}

					// Use the already-created safe fragment if context permits
					for (i = 0; (elem = elems[i]) != null; i++) {
						if (typeof elem === "number") {
							elem += "";
						}

						if (!elem) {
							continue;
						}

						// Convert html string into DOM nodes
						if (typeof elem === "string") {
							if (!rhtml.test(elem)) {
								elem = context.createTextNode(elem);
							} else {
								// Ensure a safe container in which to render the html
								safe = safe || createSafeFragment(context);
								div = context.createElement("div");
								safe.appendChild(div);

								// Fix "XHTML"-style tags in all browsers
								elem = elem.replace(rxhtmlTag, "<$1></$2>");

								// Go to html and back, then peel off extra wrappers
								tag = (rtagName.exec(elem) || ["", ""])[1].toLowerCase();
								wrap = wrapMap[tag] || wrapMap._default;
								depth = wrap[0];
								div.innerHTML = wrap[1] + elem + wrap[2];

								// Move to the right depth
								while (depth--) {
									div = div.lastChild;
								}

								// Remove IE's autoinserted <tbody> from table fragments
								if (!JQXLite.support.tbody) {

									// String was a <table>, *may* have spurious <tbody>
									hasBody = rtbody.test(elem);
									tbody = tag === "table" && !hasBody ?
										div.firstChild && div.firstChild.childNodes :

										// String was a bare <thead> or <tfoot>
										wrap[1] === "<table>" && !hasBody ?
											div.childNodes :
											[];

									for (j = tbody.length - 1; j >= 0; --j) {
										if (JQXLite.nodeName(tbody[j], "tbody") && !tbody[j].childNodes.length) {
											tbody[j].parentNode.removeChild(tbody[j]);
										}
									}
								}

								// IE completely kills leading whitespace when innerHTML is used
								if (!JQXLite.support.leadingWhitespace && rleadingWhitespace.test(elem)) {
									div.insertBefore(context.createTextNode(rleadingWhitespace.exec(elem)[0]), div.firstChild);
								}

								elem = div.childNodes;

								// Take out of fragment container (we need a fresh div each time)
								div.parentNode.removeChild(div);
							}
						}

						if (elem.nodeType) {
							ret.push(elem);
						} else {
							JQXLite.merge(ret, elem);
						}
					}

					// Fix #11356: Clear elements from safeFragment
					if (div) {
						elem = div = safe = null;
					}

					// Reset defaultChecked for any radios and checkboxes
					// about to be appended to the DOM in IE 6/7 (#8060)
					if (!JQXLite.support.appendChecked) {
						for (i = 0; (elem = ret[i]) != null; i++) {
							if (JQXLite.nodeName(elem, "input")) {
								fixDefaultChecked(elem);
							} else if (typeof elem.getElementsByTagName !== "undefined") {
								JQXLite.grep(elem.getElementsByTagName("input"), fixDefaultChecked);
							}
						}
					}

					// Append elements to a provided document fragment
					if (fragment) {
						// Special handling of each script element
						handleScript = function (elem) {
							// Check if we consider it executable
							if (!elem.type || rscriptType.test(elem.type)) {
								// Detach the script and store it in the scripts array (if provided) or the fragment
								// Return truthy to indicate that it has been handled
								return scripts ?
									scripts.push(elem.parentNode ? elem.parentNode.removeChild(elem) : elem) :
									fragment.appendChild(elem);
							}
						};

						for (i = 0; (elem = ret[i]) != null; i++) {
							// Check if we're done after handling an executable script
							if (!(JQXLite.nodeName(elem, "script") && handleScript(elem))) {
								// Append to fragment and handle embedded scripts
								fragment.appendChild(elem);
								if (typeof elem.getElementsByTagName !== "undefined") {
									// handleScript alters the DOM, so use JQXLite.merge to ensure snapshot iteration
									jsTags = JQXLite.grep(JQXLite.merge([], elem.getElementsByTagName("script")), handleScript);

									// Splice the scripts into ret after their former ancestor and advance our index beyond them
									ret.splice.apply(ret, [i + 1, 0].concat(jsTags));
									i += jsTags.length;
								}
							}
						}
					}

					return ret;
				},

				cleanData: function (elems, /* internal */ acceptData) {
					var data, id, elem, type,
						i = 0,
						internalKey = JQXLite.expando,
						cache = JQXLite.cache,
						deleteExpando = JQXLite.support.deleteExpando,
						special = JQXLite.event.special;

					for (; (elem = elems[i]) != null; i++) {

						if (acceptData || JQXLite.acceptData(elem)) {

							id = elem[internalKey];
							data = id && cache[id];

							if (data) {
								if (data.events) {
									for (type in data.events) {
										if (special[type]) {
											JQXLite.event.remove(elem, type);

											// This is a shortcut to avoid JQXLite.event.remove's overhead
										} else {
											JQXLite.removeEvent(elem, type, data.handle);
										}
									}
								}

								// Remove cache only if it was not already removed by JQXLite.event.remove
								if (cache[id]) {

									delete cache[id];

									// IE does not allow us to delete expando properties from nodes,
									// nor does it have a removeAttribute function on Document nodes;
									// we must handle all of these cases
									if (deleteExpando) {
										delete elem[internalKey];

									} else if (elem.removeAttribute) {
										elem.removeAttribute(internalKey);

									} else {
										elem[internalKey] = null;
									}

									JQXLite.deletedIds.push(id);
								}
							}
						}
					}
				}
			});
			// Limit scope pollution from any deprecated API
			(function () {

				var matched, browser;

				// Use of JQXLite.browser is frowned upon.
				// More details: http://api.jqx.com/JQXLite.browser
				// JQXLite.uaMatch maintained for back-compat
				JQXLite.uaMatch = function (ua) {
					ua = ua.toLowerCase();

					var match = /(chrome)[ \/]([\w.]+)/.exec(ua) ||
						/(webkit)[ \/]([\w.]+)/.exec(ua) ||
						/(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua) ||
						/(msie) ([\w.]+)/.exec(ua) ||
						ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua) ||
						[];

					return {
						browser: match[1] || "",
						version: match[2] || "0"
					};
				};

				matched = JQXLite.uaMatch(navigator.userAgent);
				browser = {};

				if (matched.browser) {
					browser[matched.browser] = true;
					browser.version = matched.version;
				}

				// Chrome is Webkit, but Webkit is also Safari.
				if (browser.chrome) {
					browser.webkit = true;
				} else if (browser.webkit) {
					browser.safari = true;
				}

				JQXLite.browser = browser;

				JQXLite.sub = function () {
					function jQuerySub(selector, context) {
						return new jQuerySub.fn.init(selector, context);
					}
					JQXLite.extend(true, jQuerySub, this);
					jQuerySub.superclass = this;
					jQuerySub.fn = jQuerySub.prototype = this();
					jQuerySub.fn.constructor = jQuerySub;
					jQuerySub.sub = this.sub;
					jQuerySub.fn.init = function init(selector, context) {
						if (context && context instanceof JQXLite && !(context instanceof jQuerySub)) {
							context = jQuerySub(context);
						}

						return JQXLite.fn.init.call(this, selector, context, rootJQXLiteSub);
					};
					jQuerySub.fn.init.prototype = jQuerySub.fn;
					var rootJQXLiteSub = jQuerySub(document);
					return jQuerySub;
				};

			})();
			var curCSS, iframe, iframeDoc,
				ralpha = /alpha\([^)]*\)/i,
				ropacity = /opacity=([^)]*)/,
				rposition = /^(top|right|bottom|left)$/,
				// swappable if display is none or starts with table except "table", "table-cell", or "table-caption"
				// see here for display values: https://developer.mozilla.org/en-US/docs/CSS/display
				rdisplayswap = /^(none|table(?!-c[ea]).+)/,
				rmargin = /^margin/,
				rnumsplit = new RegExp("^(" + core_pnum + ")(.*)$", "i"),
				rnumnonpx = new RegExp("^(" + core_pnum + ")(?!px)[a-z%]+$", "i"),
				rrelNum = new RegExp("^([-+])=(" + core_pnum + ")", "i"),
				elemdisplay = { BODY: "block" },

				cssShow = { position: "absolute", visibility: "hidden", display: "block" },
				cssNormalTransform = {
					letterSpacing: 0,
					fontWeight: 400
				},

				cssExpand = ["Top", "Right", "Bottom", "Left"],
				cssPrefixes = ["Webkit", "O", "Moz", "ms"],

				eventsToggle = JQXLite.fn.toggle;

			// return a css property mapped to a potentially vendor prefixed property
			function vendorPropName(style, name) {

				// shortcut for names that are not vendor prefixed
				if (name in style) {
					return name;
				}

				// check for vendor prefixed names
				var capName = name.charAt(0).toUpperCase() + name.slice(1),
					origName = name,
					i = cssPrefixes.length;

				while (i--) {
					name = cssPrefixes[i] + capName;
					if (name in style) {
						return name;
					}
				}

				return origName;
			}

			function isHidden(elem, el) {
				elem = el || elem;
				return JQXLite.css(elem, "display") === "none" || !JQXLite.contains(elem.ownerDocument, elem);
			}

			function showHide(elements, show) {
				var elem, display,
					values = [],
					index = 0,
					length = elements.length;

				for (; index < length; index++) {
					elem = elements[index];
					if (!elem.style) {
						continue;
					}
					values[index] = JQXLite._data(elem, "olddisplay");
					if (show) {
						// Reset the inline display of this element to learn if it is
						// being hidden by cascaded rules or not
						if (!values[index] && elem.style.display === "none") {
							elem.style.display = "";
						}

						// Set elements which have been overridden with display: none
						// in a stylesheet to whatever the default browser style is
						// for such an element
						if (elem.style.display === "" && isHidden(elem)) {
							values[index] = JQXLite._data(elem, "olddisplay", css_defaultDisplay(elem.nodeName));
						}
					} else {
						display = curCSS(elem, "display");

						if (!values[index] && display !== "none") {
							JQXLite._data(elem, "olddisplay", display);
						}
					}
				}

				// Set the display of most of the elements in a second loop
				// to avoid the constant reflow
				for (index = 0; index < length; index++) {
					elem = elements[index];
					if (!elem.style) {
						continue;
					}
					if (!show || elem.style.display === "none" || elem.style.display === "") {
						elem.style.display = show ? values[index] || "" : "none";
					}
				}

				return elements;
			}

			JQXLite.fn.extend({
				css: function (name, value) {
					return JQXLite.access(this, function (elem, name, value) {
						return value !== undefined ?
							JQXLite.style(elem, name, value) :
							JQXLite.css(elem, name);
					}, name, value, arguments.length > 1);
				},
				show: function () {
					return showHide(this, true);
				},
				hide: function () {
					return showHide(this);
				},
				toggle: function (state, fn2) {
					var bool = typeof state === "boolean";

					if (JQXLite.isFunction(state) && JQXLite.isFunction(fn2)) {
						return eventsToggle.apply(this, arguments);
					}

					return this.each(function () {
						if (bool ? state : isHidden(this)) {
							JQXLite(this).show();
						} else {
							JQXLite(this).hide();
						}
					});
				}
			});

			JQXLite.extend({
				// Add in style property hooks for overriding the default
				// behavior of getting and setting a style property
				cssHooks: {
					opacity: {
						get: function (elem, computed) {
							if (computed) {
								// We should always get a number back from opacity
								var ret = curCSS(elem, "opacity");
								return ret === "" ? "1" : ret;

							}
						}
					}
				},

				// Exclude the following css properties to add px
				cssNumber: {
					"fillOpacity": true,
					"fontWeight": true,
					"lineHeight": true,
					"opacity": true,
					"orphans": true,
					"widows": true,
					"zIndex": true,
					"zoom": true
				},

				// Add in properties whose names you wish to fix before
				// setting or getting the value
				cssProps: {
					// normalize float css property
					"float": JQXLite.support.cssFloat ? "cssFloat" : "styleFloat"
				},

				// Get and set the style property on a DOM Node
				style: function (elem, name, value, extra) {
					// Don't set styles on text and comment nodes
					if (!elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style) {
						return;
					}

					// Make sure that we're working with the right name
					var ret, type, hooks,
						origName = JQXLite.camelCase(name),
						style = elem.style;

					name = JQXLite.cssProps[origName] || (JQXLite.cssProps[origName] = vendorPropName(style, origName));

					// gets hook for the prefixed version
					// followed by the unprefixed version
					hooks = JQXLite.cssHooks[name] || JQXLite.cssHooks[origName];

					// Check if we're setting a value
					if (value !== undefined) {
						type = typeof value;

						// convert relative number strings (+= or -=) to relative numbers. #7345
						if (type === "string" && (ret = rrelNum.exec(value))) {
							value = (ret[1] + 1) * ret[2] + parseFloat(JQXLite.css(elem, name));
							// Fixes bug #9237
							type = "number";
						}

						// Make sure that NaN and null values aren't set. See: #7116
						if (value == null || type === "number" && isNaN(value)) {
							return;
						}

						// If a number was passed in, add 'px' to the (except for certain CSS properties)
						if (type === "number" && !JQXLite.cssNumber[origName]) {
							value += "px";
						}

						// If a hook was provided, use that value, otherwise just set the specified value
						if (!hooks || !("set" in hooks) || (value = hooks.set(elem, value, extra)) !== undefined) {
							// Wrapped to prevent IE from throwing errors when 'invalid' values are provided
							// Fixes bug #5509
							try {
								style[name] = value;
							} catch (e) { }
						}

					} else {
						// If a hook was provided get the non-computed value from there
						if (hooks && "get" in hooks && (ret = hooks.get(elem, false, extra)) !== undefined) {
							return ret;
						}

						// Otherwise just get the value from the style object
						return style[name];
					}
				},

				css: function (elem, name, numeric, extra) {
					var val, num, hooks,
						origName = JQXLite.camelCase(name);

					// Make sure that we're working with the right name
					name = JQXLite.cssProps[origName] || (JQXLite.cssProps[origName] = vendorPropName(elem.style, origName));

					// gets hook for the prefixed version
					// followed by the unprefixed version
					hooks = JQXLite.cssHooks[name] || JQXLite.cssHooks[origName];

					// If a hook was provided get the computed value from there
					if (hooks && "get" in hooks) {
						val = hooks.get(elem, true, extra);
					}

					// Otherwise, if a way to get the computed value exists, use that
					if (val === undefined) {
						val = curCSS(elem, name);
					}

					//convert "normal" to computed value
					if (val === "normal" && name in cssNormalTransform) {
						val = cssNormalTransform[name];
					}

					// Return, converting to number if forced or a qualifier was provided and val looks numeric
					if (numeric || extra !== undefined) {
						num = parseFloat(val);
						return numeric || JQXLite.isNumeric(num) ? num || 0 : val;
					}
					return val;
				},

				// A method for quickly swapping in/out CSS properties to get correct calculations
				swap: function (elem, options, callback) {
					var ret, name,
						old = {};

					// Remember the old values, and insert the new ones
					for (name in options) {
						old[name] = elem.style[name];
						elem.style[name] = options[name];
					}

					ret = callback.call(elem);

					// Revert the old values
					for (name in options) {
						elem.style[name] = old[name];
					}

					return ret;
				}
			});

			// NOTE: To any future maintainer, we've window.getComputedStyle
			// because jsdom on node.js will break without it.
			if (window.getComputedStyle) {
				curCSS = function (elem, name) {
					var ret, width, minWidth, maxWidth,
						computed = window.getComputedStyle(elem, null),
						style = elem.style;

					if (computed) {

						// getPropertyValue is only needed for .css('filter') in IE9, see #12537
						ret = computed.getPropertyValue(name) || computed[name];

						if (ret === "" && !JQXLite.contains(elem.ownerDocument, elem)) {
							ret = JQXLite.style(elem, name);
						}

						// A tribute to the "awesome hack by Dean Edwards"
						// Chrome < 17 and Safari 5.0 uses "computed value" instead of "used value" for margin-right
						// Safari 5.1.7 (at least) returns percentage for a larger set of values, but width seems to be reliably pixels
						// this is against the CSSOM draft spec: http://dev.w3.org/csswg/cssom/#resolved-values
						if (rnumnonpx.test(ret) && rmargin.test(name)) {
							width = style.width;
							minWidth = style.minWidth;
							maxWidth = style.maxWidth;

							style.minWidth = style.maxWidth = style.width = ret;
							ret = computed.width;

							style.width = width;
							style.minWidth = minWidth;
							style.maxWidth = maxWidth;
						}
					}

					return ret;
				};
			} else if (document.documentElement.currentStyle) {
				curCSS = function (elem, name) {
					var left, rsLeft,
						ret = elem.currentStyle && elem.currentStyle[name],
						style = elem.style;

					// Avoid setting ret to empty string here
					// so we don't default to auto
					if (ret == null && style && style[name]) {
						ret = style[name];
					}

					// From the awesome hack by Dean Edwards
					// http://erik.eae.net/archives/2007/07/27/18.54.15/#comment-102291

					// If we're not dealing with a regular pixel number
					// but a number that has a weird ending, we need to convert it to pixels
					// but not position css attributes, as those are proportional to the parent element instead
					// and we can't measure the parent instead because it might trigger a "stacking dolls" problem
					if (rnumnonpx.test(ret) && !rposition.test(name)) {

						// Remember the original values
						left = style.left;
						rsLeft = elem.runtimeStyle && elem.runtimeStyle.left;

						// Put in the new values to get a computed value out
						if (rsLeft) {
							elem.runtimeStyle.left = elem.currentStyle.left;
						}
						style.left = name === "fontSize" ? "1em" : ret;
						ret = style.pixelLeft + "px";

						// Revert the changed values
						style.left = left;
						if (rsLeft) {
							elem.runtimeStyle.left = rsLeft;
						}
					}

					return ret === "" ? "auto" : ret;
				};
			}

			function setPositiveNumber(elem, value, subtract) {
				var matches = rnumsplit.exec(value);
				return matches ?
					Math.max(0, matches[1] - (subtract || 0)) + (matches[2] || "px") :
					value;
			}

			function augmentWidthOrHeight(elem, name, extra, isBorderBox) {
				var i = extra === (isBorderBox ? "border" : "content") ?
					// If we already have the right measurement, avoid augmentation
					4 :
					// Otherwise initialize for horizontal or vertical properties
					name === "width" ? 1 : 0,

					val = 0;

				for (; i < 4; i += 2) {
					// both box models exclude margin, so add it if we want it
					if (extra === "margin") {
						// we use JQXLite.css instead of curCSS here
						// because of the reliableMarginRight CSS hook!
						val += JQXLite.css(elem, extra + cssExpand[i], true);
					}

					// From this point on we use curCSS for maximum performance (relevant in animations)
					if (isBorderBox) {
						// border-box includes padding, so remove it if we want content
						if (extra === "content") {
							val -= parseFloat(curCSS(elem, "padding" + cssExpand[i])) || 0;
						}

						// at this point, extra isn't border nor margin, so remove border
						if (extra !== "margin") {
							val -= parseFloat(curCSS(elem, "border" + cssExpand[i] + "Width")) || 0;
						}
					} else {
						// at this point, extra isn't content, so add padding
						val += parseFloat(curCSS(elem, "padding" + cssExpand[i])) || 0;

						// at this point, extra isn't content nor padding, so add border
						if (extra !== "padding") {
							val += parseFloat(curCSS(elem, "border" + cssExpand[i] + "Width")) || 0;
						}
					}
				}

				return val;
			}

			function getWidthOrHeight(elem, name, extra) {

				// Start with offset property, which is equivalent to the border-box value
				var val = name === "width" ? elem.offsetWidth : elem.offsetHeight,
					valueIsBorderBox = true,
					isBorderBox = JQXLite.support.boxSizing && JQXLite.css(elem, "boxSizing") === "border-box";

				// some non-html elements return undefined for offsetWidth, so check for null/undefined
				// svg - https://bugzilla.mozilla.org/show_bug.cgi?id=649285
				// MathML - https://bugzilla.mozilla.org/show_bug.cgi?id=491668
				if (val <= 0 || val == null) {
					// Fall back to computed then uncomputed css if necessary
					val = curCSS(elem, name);
					if (val < 0 || val == null) {
						val = elem.style[name];
					}

					// Computed unit is not pixels. Stop here and return.
					if (rnumnonpx.test(val)) {
						return val;
					}

					// we need the check for style in case a browser which returns unreliable values
					// for getComputedStyle silently falls back to the reliable elem.style
					valueIsBorderBox = isBorderBox && (JQXLite.support.boxSizingReliable || val === elem.style[name]);

					// Normalize "", auto, and prepare for extra
					val = parseFloat(val) || 0;
				}

				// use the active box-sizing model to add/subtract irrelevant styles
				return (val +
					augmentWidthOrHeight(
						elem,
						name,
						extra || (isBorderBox ? "border" : "content"),
						valueIsBorderBox
					)
				) + "px";
			}


			// Try to determine the default display value of an element
			function css_defaultDisplay(nodeName) {
				if (elemdisplay[nodeName]) {
					return elemdisplay[nodeName];
				}

				var elem = JQXLite("<" + nodeName + ">").appendTo(document.body),
					display = elem.css("display");
				elem.remove();

				// If the simple way fails,
				// get element's real default display by attaching it to a temp iframe
				if (display === "none" || display === "") {
					// Use the already-created iframe if possible
					iframe = document.body.appendChild(
						iframe || JQXLite.extend(document.createElement("iframe"), {
							frameBorder: 0,
							width: 0,
							height: 0
						})
					);

					// Create a cacheable copy of the iframe document on first call.
					// IE and Opera will allow us to reuse the iframeDoc without re-writing the fake HTML
					// document to it; WebKit & Firefox won't allow reusing the iframe document.
					if (!iframeDoc || !iframe.createElement) {
						iframeDoc = (iframe.contentWindow || iframe.contentDocument).document;
						iframeDoc.write("<!doctype html><html><body>");
						iframeDoc.close();
					}

					elem = iframeDoc.body.appendChild(iframeDoc.createElement(nodeName));

					display = curCSS(elem, "display");
					document.body.removeChild(iframe);
				}

				// Store the correct default display
				elemdisplay[nodeName] = display;

				return display;
			}

			JQXLite.each(["height", "width"], function (i, name) {
				JQXLite.cssHooks[name] = {
					get: function (elem, computed, extra) {
						if (computed) {
							// certain elements can have dimension info if we invisibly show them
							// however, it must have a current display style that would benefit from this
							if (elem.offsetWidth === 0 && rdisplayswap.test(curCSS(elem, "display"))) {
								return JQXLite.swap(elem, cssShow, function () {
									return getWidthOrHeight(elem, name, extra);
								});
							} else {
								return getWidthOrHeight(elem, name, extra);
							}
						}
					},

					set: function (elem, value, extra) {
						return setPositiveNumber(elem, value, extra ?
							augmentWidthOrHeight(
								elem,
								name,
								extra,
								JQXLite.support.boxSizing && JQXLite.css(elem, "boxSizing") === "border-box"
							) : 0
						);
					}
				};
			});

			if (!JQXLite.support.opacity) {
				JQXLite.cssHooks.opacity = {
					get: function (elem, computed) {
						// IE uses filters for opacity
						return ropacity.test((computed && elem.currentStyle ? elem.currentStyle.filter : elem.style.filter) || "") ?
							(0.01 * parseFloat(RegExp.$1)) + "" :
							computed ? "1" : "";
					},

					set: function (elem, value) {
						var style = elem.style,
							currentStyle = elem.currentStyle,
							opacity = JQXLite.isNumeric(value) ? "alpha(opacity=" + value * 100 + ")" : "",
							filter = currentStyle && currentStyle.filter || style.filter || "";

						// IE has trouble with opacity if it does not have layout
						// Force it by setting the zoom level
						style.zoom = 1;

						// if setting opacity to 1, and no other filters exist - attempt to remove filter attribute #6652
						if (value >= 1 && JQXLite.trim(filter.replace(ralpha, "")) === "" &&
							style.removeAttribute) {

							// Setting style.filter to null, "" & " " still leave "filter:" in the cssText
							// if "filter:" is present at all, clearType is disabled, we want to avoid this
							// style.removeAttribute is IE Only, but so apparently is this code path...
							style.removeAttribute("filter");

							// if there there is no filter style applied in a css rule, we are done
							if (currentStyle && !currentStyle.filter) {
								return;
							}
						}

						// otherwise, set new filter values
						style.filter = ralpha.test(filter) ?
							filter.replace(ralpha, opacity) :
							filter + " " + opacity;
					}
				};
			}

			// These hooks cannot be added until DOM ready because the support test
			// for it is not run until after DOM ready
			JQXLite(function () {
				if (!JQXLite.support.reliableMarginRight) {
					JQXLite.cssHooks.marginRight = {
						get: function (elem, computed) {
							// WebKit Bug 13343 - getComputedStyle returns wrong value for margin-right
							// Work around by temporarily setting element display to inline-block
							return JQXLite.swap(elem, { "display": "inline-block" }, function () {
								if (computed) {
									return curCSS(elem, "marginRight");
								}
							});
						}
					};
				}

				// Webkit bug: https://bugs.webkit.org/show_bug.cgi?id=29084
				// getComputedStyle returns percent when specified for top/left/bottom/right
				// rather than make the css module depend on the offset module, we just check for it here
				if (!JQXLite.support.pixelPosition && JQXLite.fn.position) {
					JQXLite.each(["top", "left"], function (i, prop) {
						JQXLite.cssHooks[prop] = {
							get: function (elem, computed) {
								if (computed) {
									var ret = curCSS(elem, prop);
									// if curCSS returns percentage, fallback to offset
									return rnumnonpx.test(ret) ? JQXLite(elem).position()[prop] + "px" : ret;
								}
							}
						};
					});
				}

			});

			if (JQXLite.expr && JQXLite.expr.filters) {
				JQXLite.expr.filters.hidden = function (elem) {
					return (elem.offsetWidth === 0 && elem.offsetHeight === 0) || (!JQXLite.support.reliableHiddenOffsets && ((elem.style && elem.style.display) || curCSS(elem, "display")) === "none");
				};

				JQXLite.expr.filters.visible = function (elem) {
					return !JQXLite.expr.filters.hidden(elem);
				};
			}

			// These hooks are used by animate to expand properties
			JQXLite.each({
				margin: "",
				padding: "",
				border: "Width"
			}, function (prefix, suffix) {
				JQXLite.cssHooks[prefix + suffix] = {
					expand: function (value) {
						var i,

							// assumes a single number if not a string
							parts = typeof value === "string" ? value.split(" ") : [value],
							expanded = {};

						for (i = 0; i < 4; i++) {
							expanded[prefix + cssExpand[i] + suffix] =
								parts[i] || parts[i - 2] || parts[0];
						}

						return expanded;
					}
				};

				if (!rmargin.test(prefix)) {
					JQXLite.cssHooks[prefix + suffix].set = setPositiveNumber;
				}
			});
			var r20 = /%20/g,
				rbracket = /\[\]$/,
				rCRLF = /\r?\n/g,
				rinput = /^(?:color|date|datetime|datetime-local|email|hidden|month|number|password|range|search|tel|text|time|url|week)$/i,
				rselectTextarea = /^(?:select|textarea)/i;

			JQXLite.fn.extend({
				serialize: function () {
					return JQXLite.param(this.serializeArray());
				},
				serializeArray: function () {
					return this.map(function () {
						return this.elements ? JQXLite.makeArray(this.elements) : this;
					})
						.filter(function () {
							return this.name && !this.disabled &&
								(this.checked || rselectTextarea.test(this.nodeName) ||
									rinput.test(this.type));
						})
						.map(function (i, elem) {
							var val = JQXLite(this).val();

							return val == null ?
								null :
								JQXLite.isArray(val) ?
									JQXLite.map(val, function (val, i) {
										return { name: elem.name, value: val.replace(rCRLF, "\r\n") };
									}) :
									{ name: elem.name, value: val.replace(rCRLF, "\r\n") };
						}).get();
				}
			});

			//Serialize an array of form elements or a set of
			//key/values into a query string
			JQXLite.param = function (a, traditional) {
				var prefix,
					s = [],
					add = function (key, value) {
						// If value is a function, invoke it and return its value
						value = JQXLite.isFunction(value) ? value() : (value == null ? "" : value);
						s[s.length] = encodeURIComponent(key) + "=" + encodeURIComponent(value);
					};

				// Set traditional to true for JQXLite <= 1.3.2 behavior.
				if (traditional === undefined) {
					traditional = JQXLite.ajaxSettings && JQXLite.ajaxSettings.traditional;
				}

				// If an array was passed in, assume that it is an array of form elements.
				if (JQXLite.isArray(a) || (a.jqx && !JQXLite.isPlainObject(a))) {
					// Serialize the form elements
					JQXLite.each(a, function () {
						add(this.name, this.value);
					});

				} else {
					// If traditional, encode the "old" way (the way 1.3.2 or older
					// did it), otherwise encode params recursively.
					for (prefix in a) {
						buildParams(prefix, a[prefix], traditional, add);
					}
				}

				// Return the resulting serialization
				return s.join("&").replace(r20, "+");
			};

			function buildParams(prefix, obj, traditional, add) {
				var name;

				if (JQXLite.isArray(obj)) {
					// Serialize array item.
					JQXLite.each(obj, function (i, v) {
						if (traditional || rbracket.test(prefix)) {
							// Treat each array item as a scalar.
							add(prefix, v);

						} else {
							// If array item is non-scalar (array or object), encode its
							// numeric index to resolve deserialization ambiguity issues.
							// Note that rack (as of 1.0.0) can't currently deserialize
							// nested arrays properly, and attempting to do so may cause
							// a server error. Possible fixes are to modify rack's
							// deserialization algorithm or to provide an option or flag
							// to force array serialization to be shallow.
							buildParams(prefix + "[" + (typeof v === "object" ? i : "") + "]", v, traditional, add);
						}
					});

				} else if (!traditional && JQXLite.type(obj) === "object") {
					// Serialize object item.
					for (name in obj) {
						buildParams(prefix + "[" + name + "]", obj[name], traditional, add);
					}

				} else {
					// Serialize scalar item.
					add(prefix, obj);
				}
			}


			// Create transport if the browser can provide an xhr
			if (JQXLite.support.ajax) {

				JQXLite.ajaxTransport(function (s) {
					// Cross domain only allowed if supported through XMLHttpRequest
					if (!s.crossDomain || JQXLite.support.cors) {

						var callback;

						return {
							send: function (headers, complete) {

								// Get a new xhr
								var handle, i,
									xhr = s.xhr();

								// Open the socket
								// Passing null username, generates a login popup on Opera (#2865)
								if (s.username) {
									xhr.open(s.type, s.url, s.async, s.username, s.password);
								} else {
									xhr.open(s.type, s.url, s.async);
								}

								// Apply custom fields if provided
								if (s.xhrFields) {
									for (i in s.xhrFields) {
										xhr[i] = s.xhrFields[i];
									}
								}

								// Override mime type if needed
								if (s.mimeType && xhr.overrideMimeType) {
									xhr.overrideMimeType(s.mimeType);
								}

								// X-Requested-With header
								// For cross-domain requests, seeing as conditions for a preflight are
								// akin to a jigsaw puzzle, we simply never set it to be sure.
								// (it can always be set on a per-request basis or even using ajaxSetup)
								// For same-domain requests, won't change header if already provided.
								if (!s.crossDomain && !headers["X-Requested-With"]) {
									headers["X-Requested-With"] = "XMLHttpRequest";
								}

								// Need an extra try/catch for cross domain requests in Firefox 3
								try {
									for (i in headers) {
										xhr.setRequestHeader(i, headers[i]);
									}
								} catch (_) { }

								// Do send the request
								// This may raise an exception which is actually
								// handled in JQXLite.ajax (so no try/catch here)
								xhr.send((s.hasContent && s.data) || null);

								// Listener
								callback = function (_, isAbort) {

									var status,
										statusText,
										responseHeaders,
										responses,
										xml;

									// Firefox throws exceptions when accessing properties
									// of an xhr when a network error occurred
									// http://helpful.knobs-dials.com/index.php/Component_returned_failure_code:_0x80040111_(NS_ERROR_NOT_AVAILABLE)
									try {

										// Was never called and is aborted or complete
										if (callback && (isAbort || xhr.readyState === 4)) {

											// Only called once
											callback = undefined;

											// Do not keep as active anymore
											if (handle) {
												xhr.onreadystatechange = JQXLite.noop;
												if (xhrOnUnloadAbort) {
													delete xhrCallbacks[handle];
												}
											}

											// If it's an abort
											if (isAbort) {
												// Abort it manually if needed
												if (xhr.readyState !== 4) {
													xhr.abort();
												}
											} else {
												status = xhr.status;
												responseHeaders = xhr.getAllResponseHeaders();
												responses = {};
												xml = xhr.responseXML;

												// Construct response list
												if (xml && xml.documentElement /* #4958 */) {
													responses.xml = xml;
												}

												// When requesting binary data, IE6-9 will throw an exception
												// on any attempt to access responseText (#11426)
												try {
													responses.text = xhr.responseText;
												} catch (e) {
												}

												// Firefox throws an exception when accessing
												// statusText for faulty cross-domain requests
												try {
													statusText = xhr.statusText;
												} catch (e) {
													// We normalize with Webkit giving an empty statusText
													statusText = "";
												}

												// Filter status for non standard behaviors

												// If the request is local and we have data: assume a success
												// (success with no data won't get notified, that's the best we
												// can do given current implementations)
												if (!status && s.isLocal && !s.crossDomain) {
													status = responses.text ? 200 : 404;
													// IE - #1450: sometimes returns 1223 when it should be 204
												} else if (status === 1223) {
													status = 204;
												}
											}
										}
									} catch (firefoxAccessException) {
										if (!isAbort) {
											complete(-1, firefoxAccessException);
										}
									}

									// Call complete if needed
									if (responses) {
										complete(status, statusText, responses, responseHeaders);
									}
								};

								if (!s.async) {
									// if we're in sync mode we fire the callback
									callback();
								} else if (xhr.readyState === 4) {
									// (IE6 & IE7) if it's in cache and has been
									// retrieved directly we need to fire the callback
									setTimeout(callback, 0);
								} else {
									handle = ++xhrId;
									if (xhrOnUnloadAbort) {
										// Create the active xhrs callbacks list if needed
										// and attach the unload handler
										if (!xhrCallbacks) {
											xhrCallbacks = {};
											JQXLite(window).unload(xhrOnUnloadAbort);
										}
										// Add to list of active xhrs callbacks
										xhrCallbacks[handle] = callback;
									}
									xhr.onreadystatechange = callback;
								}
							},

							abort: function () {
								if (callback) {
									callback(0, 1);
								}
							}
						};
					}
				});
			}
			var fxNow, timerId,
				rfxtypes = /^(?:toggle|show|hide)$/,
				rfxnum = new RegExp("^(?:([-+])=|)(" + core_pnum + ")([a-z%]*)$", "i"),
				rrun = /queueHooks$/,
				animationPrefilters = [defaultPrefilter],
				tweeners = {
					"*": [function (prop, value) {
						var end, unit,
							tween = this.createTween(prop, value),
							parts = rfxnum.exec(value),
							target = tween.cur(),
							start = +target || 0,
							scale = 1,
							maxIterations = 20;

						if (parts) {
							end = +parts[2];
							unit = parts[3] || (JQXLite.cssNumber[prop] ? "" : "px");

							// We need to compute starting value
							if (unit !== "px" && start) {
								// Iteratively approximate from a nonzero starting point
								// Prefer the current property, because this process will be trivial if it uses the same units
								// Fallback to end or a simple constant
								start = JQXLite.css(tween.elem, prop, true) || end || 1;

								do {
									// If previous iteration zeroed out, double until we get *something*
									// Use a string for doubling factor so we don't accidentally see scale as unchanged below
									scale = scale || ".5";

									// Adjust and apply
									start = start / scale;
									JQXLite.style(tween.elem, prop, start + unit);

									// Update scale, tolerating zero or NaN from tween.cur()
									// And breaking the loop if scale is unchanged or perfect, or if we've just had enough
								} while (scale !== (scale = tween.cur() / target) && scale !== 1 && --maxIterations);
							}

							tween.unit = unit;
							tween.start = start;
							// If a +=/-= token was provided, we're doing a relative animation
							tween.end = parts[1] ? start + (parts[1] + 1) * end : end;
						}
						return tween;
					}]
				};

			// Animations created synchronously will run synchronously
			function createFxNow() {
				setTimeout(function () {
					fxNow = undefined;
				}, 0);
				return (fxNow = JQXLite.now());
			}

			function createTweens(animation, props) {
				JQXLite.each(props, function (prop, value) {
					var collection = (tweeners[prop] || []).concat(tweeners["*"]),
						index = 0,
						length = collection.length;
					for (; index < length; index++) {
						if (collection[index].call(animation, prop, value)) {

							// we're done with this property
							return;
						}
					}
				});
			}

			function Animation(elem, properties, options) {
				var result,
					index = 0,
					tweenerIndex = 0,
					length = animationPrefilters.length,
					deferred = JQXLite.Deferred().always(function () {
						// don't match elem in the :animated selector
						delete tick.elem;
					}),
					tick = function () {
						var currentTime = fxNow || createFxNow(),
							remaining = Math.max(0, animation.startTime + animation.duration - currentTime),
							// archaic crash bug won't allow us to use 1 - ( 0.5 || 0 ) (#12497)
							temp = remaining / animation.duration || 0,
							percent = 1 - temp,
							index = 0,
							length = animation.tweens.length;

						for (; index < length; index++) {
							animation.tweens[index].run(percent);
						}

						deferred.notifyWith(elem, [animation, percent, remaining]);

						if (percent < 1 && length) {
							return remaining;
						} else {
							deferred.resolveWith(elem, [animation]);
							return false;
						}
					},
					animation = deferred.promise({
						elem: elem,
						props: JQXLite.extend({}, properties),
						opts: JQXLite.extend(true, { specialEasing: {} }, options),
						originalProperties: properties,
						originalOptions: options,
						startTime: fxNow || createFxNow(),
						duration: options.duration,
						tweens: [],
						createTween: function (prop, end, easing) {
							var tween = JQXLite.Tween(elem, animation.opts, prop, end,
								animation.opts.specialEasing[prop] || animation.opts.easing);
							animation.tweens.push(tween);
							return tween;
						},
						stop: function (gotoEnd) {
							var index = 0,
								// if we are going to the end, we want to run all the tweens
								// otherwise we skip this part
								length = gotoEnd ? animation.tweens.length : 0;

							for (; index < length; index++) {
								animation.tweens[index].run(1);
							}

							// resolve when we played the last frame
							// otherwise, reject
							if (gotoEnd) {
								deferred.resolveWith(elem, [animation, gotoEnd]);
							} else {
								deferred.rejectWith(elem, [animation, gotoEnd]);
							}
							return this;
						}
					}),
					props = animation.props;

				propFilter(props, animation.opts.specialEasing);

				for (; index < length; index++) {
					result = animationPrefilters[index].call(animation, elem, props, animation.opts);
					if (result) {
						return result;
					}
				}

				createTweens(animation, props);

				if (JQXLite.isFunction(animation.opts.start)) {
					animation.opts.start.call(elem, animation);
				}

				JQXLite.fx.timer(
					JQXLite.extend(tick, {
						anim: animation,
						queue: animation.opts.queue,
						elem: elem
					})
				);

				// attach callbacks from options
				return animation.progress(animation.opts.progress)
					.done(animation.opts.done, animation.opts.complete)
					.fail(animation.opts.fail)
					.always(animation.opts.always);
			}

			function propFilter(props, specialEasing) {
				var index, name, easing, value, hooks;

				// camelCase, specialEasing and expand cssHook pass
				for (index in props) {
					name = JQXLite.camelCase(index);
					easing = specialEasing[name];
					value = props[index];
					if (JQXLite.isArray(value)) {
						easing = value[1];
						value = props[index] = value[0];
					}

					if (index !== name) {
						props[name] = value;
						delete props[index];
					}

					hooks = JQXLite.cssHooks[name];
					if (hooks && "expand" in hooks) {
						value = hooks.expand(value);
						delete props[name];

						// not quite $.extend, this wont overwrite keys already present.
						// also - reusing 'index' from above because we have the correct "name"
						for (index in value) {
							if (!(index in props)) {
								props[index] = value[index];
								specialEasing[index] = easing;
							}
						}
					} else {
						specialEasing[name] = easing;
					}
				}
			}

			JQXLite.Animation = JQXLite.extend(Animation, {

				tweener: function (props, callback) {
					if (JQXLite.isFunction(props)) {
						callback = props;
						props = ["*"];
					} else {
						props = props.split(" ");
					}

					var prop,
						index = 0,
						length = props.length;

					for (; index < length; index++) {
						prop = props[index];
						tweeners[prop] = tweeners[prop] || [];
						tweeners[prop].unshift(callback);
					}
				},

				prefilter: function (callback, prepend) {
					if (prepend) {
						animationPrefilters.unshift(callback);
					} else {
						animationPrefilters.push(callback);
					}
				}
			});

			function defaultPrefilter(elem, props, opts) {
				var index, prop, value, length, dataShow, toggle, tween, hooks, oldfire,
					anim = this,
					style = elem.style,
					orig = {},
					handled = [],
					hidden = elem.nodeType && isHidden(elem);

				// handle queue: false promises
				if (!opts.queue) {
					hooks = JQXLite._queueHooks(elem, "fx");
					if (hooks.unqueued == null) {
						hooks.unqueued = 0;
						oldfire = hooks.empty.fire;
						hooks.empty.fire = function () {
							if (!hooks.unqueued) {
								oldfire();
							}
						};
					}
					hooks.unqueued++;

					anim.always(function () {
						// doing this makes sure that the complete handler will be called
						// before this completes
						anim.always(function () {
							hooks.unqueued--;
							if (!JQXLite.queue(elem, "fx").length) {
								hooks.empty.fire();
							}
						});
					});
				}

				// height/width overflow pass
				if (elem.nodeType === 1 && ("height" in props || "width" in props)) {
					// Make sure that nothing sneaks out
					// Record all 3 overflow attributes because IE does not
					// change the overflow attribute when overflowX and
					// overflowY are set to the same value
					opts.overflow = [style.overflow, style.overflowX, style.overflowY];

					// Set display property to inline-block for height/width
					// animations on inline elements that are having width/height animated
					if (JQXLite.css(elem, "display") === "inline" &&
						JQXLite.css(elem, "float") === "none") {

						// inline-level elements accept inline-block;
						// block-level elements need to be inline with layout
						if (!JQXLite.support.inlineBlockNeedsLayout || css_defaultDisplay(elem.nodeName) === "inline") {
							style.display = "inline-block";

						} else {
							style.zoom = 1;
						}
					}
				}

				if (opts.overflow) {
					style.overflow = "hidden";
					if (!JQXLite.support.shrinkWrapBlocks) {
						anim.done(function () {
							style.overflow = opts.overflow[0];
							style.overflowX = opts.overflow[1];
							style.overflowY = opts.overflow[2];
						});
					}
				}


				// show/hide pass
				for (index in props) {
					value = props[index];
					if (rfxtypes.exec(value)) {
						delete props[index];
						toggle = toggle || value === "toggle";
						if (value === (hidden ? "hide" : "show")) {
							continue;
						}
						handled.push(index);
					}
				}

				length = handled.length;
				if (length) {
					dataShow = JQXLite._data(elem, "fxshow") || JQXLite._data(elem, "fxshow", {});
					if ("hidden" in dataShow) {
						hidden = dataShow.hidden;
					}

					// store state if its toggle - enables .stop().toggle() to "reverse"
					if (toggle) {
						dataShow.hidden = !hidden;
					}
					if (hidden) {
						JQXLite(elem).show();
					} else {
						anim.done(function () {
							JQXLite(elem).hide();
						});
					}
					anim.done(function () {
						var prop;
						JQXLite.removeData(elem, "fxshow", true);
						for (prop in orig) {
							JQXLite.style(elem, prop, orig[prop]);
						}
					});
					for (index = 0; index < length; index++) {
						prop = handled[index];
						tween = anim.createTween(prop, hidden ? dataShow[prop] : 0);
						orig[prop] = dataShow[prop] || JQXLite.style(elem, prop);

						if (!(prop in dataShow)) {
							dataShow[prop] = tween.start;
							if (hidden) {
								tween.end = tween.start;
								tween.start = prop === "width" || prop === "height" ? 1 : 0;
							}
						}
					}
				}
			}

			function Tween(elem, options, prop, end, easing) {
				return new Tween.prototype.init(elem, options, prop, end, easing);
			}
			JQXLite.Tween = Tween;

			Tween.prototype = {
				constructor: Tween,
				init: function (elem, options, prop, end, easing, unit) {
					this.elem = elem;
					this.prop = prop;
					this.easing = easing || "swing";
					this.options = options;
					this.start = this.now = this.cur();
					this.end = end;
					this.unit = unit || (JQXLite.cssNumber[prop] ? "" : "px");
				},
				cur: function () {
					var hooks = Tween.propHooks[this.prop];

					return hooks && hooks.get ?
						hooks.get(this) :
						Tween.propHooks._default.get(this);
				},
				run: function (percent) {
					var eased,
						hooks = Tween.propHooks[this.prop];

					if (this.options.duration) {
						this.pos = eased = JQXLite.easing[this.easing](
							percent, this.options.duration * percent, 0, 1, this.options.duration
						);
					} else {
						this.pos = eased = percent;
					}
					this.now = (this.end - this.start) * eased + this.start;

					if (this.options.step) {
						this.options.step.call(this.elem, this.now, this);
					}

					if (hooks && hooks.set) {
						hooks.set(this);
					} else {
						Tween.propHooks._default.set(this);
					}
					return this;
				}
			};

			Tween.prototype.init.prototype = Tween.prototype;

			Tween.propHooks = {
				_default: {
					get: function (tween) {
						var result;

						if (tween.elem[tween.prop] != null &&
							(!tween.elem.style || tween.elem.style[tween.prop] == null)) {
							return tween.elem[tween.prop];
						}

						// passing any value as a 4th parameter to .css will automatically
						// attempt a parseFloat and fallback to a string if the parse fails
						// so, simple values such as "10px" are parsed to Float.
						// complex values such as "rotate(1rad)" are returned as is.
						result = JQXLite.css(tween.elem, tween.prop, false, "");
						// Empty strings, null, undefined and "auto" are converted to 0.
						return !result || result === "auto" ? 0 : result;
					},
					set: function (tween) {
						// use step hook for back compat - use cssHook if its there - use .style if its
						// available and use plain properties where available
						if (JQXLite.fx.step[tween.prop]) {
							JQXLite.fx.step[tween.prop](tween);
						} else if (tween.elem.style && (tween.elem.style[JQXLite.cssProps[tween.prop]] != null || JQXLite.cssHooks[tween.prop])) {
							JQXLite.style(tween.elem, tween.prop, tween.now + tween.unit);
						} else {
							tween.elem[tween.prop] = tween.now;
						}
					}
				}
			};

			// Remove in 2.0 - this supports IE8's panic based approach
			// to setting things on disconnected nodes

			Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
				set: function (tween) {
					if (tween.elem.nodeType && tween.elem.parentNode) {
						tween.elem[tween.prop] = tween.now;
					}
				}
			};

			JQXLite.each(["toggle", "show", "hide"], function (i, name) {
				var cssFn = JQXLite.fn[name];
				JQXLite.fn[name] = function (speed, easing, callback) {
					return speed == null || typeof speed === "boolean" ||
						// special check for .toggle( handler, handler, ... )
						(!i && JQXLite.isFunction(speed) && JQXLite.isFunction(easing)) ?
						cssFn.apply(this, arguments) :
						this.animate(genFx(name, true), speed, easing, callback);
				};
			});

			JQXLite.fn.extend({
				fadeTo: function (speed, to, easing, callback) {

					// show any hidden elements after setting opacity to 0
					return this.filter(isHidden).css("opacity", 0).show()

						// animate to the value specified
						.end().animate({ opacity: to }, speed, easing, callback);
				},
				animate: function (prop, speed, easing, callback) {
					var empty = JQXLite.isEmptyObject(prop),
						optall = JQXLite.speed(speed, easing, callback),
						doAnimation = function () {
							// Operate on a copy of prop so per-property easing won't be lost
							var anim = Animation(this, JQXLite.extend({}, prop), optall);

							// Empty animations resolve immediately
							if (empty) {
								anim.stop(true);
							}
						};

					return empty || optall.queue === false ?
						this.each(doAnimation) :
						this.queue(optall.queue, doAnimation);
				},
				stop: function (type, clearQueue, gotoEnd) {
					var stopQueue = function (hooks) {
						var stop = hooks.stop;
						delete hooks.stop;
						stop(gotoEnd);
					};

					if (typeof type !== "string") {
						gotoEnd = clearQueue;
						clearQueue = type;
						type = undefined;
					}
					if (clearQueue && type !== false) {
						this.queue(type || "fx", []);
					}

					return this.each(function () {
						var dequeue = true,
							index = type != null && type + "queueHooks",
							timers = JQXLite.timers,
							data = JQXLite._data(this);

						if (index) {
							if (data[index] && data[index].stop) {
								stopQueue(data[index]);
							}
						} else {
							for (index in data) {
								if (data[index] && data[index].stop && rrun.test(index)) {
									stopQueue(data[index]);
								}
							}
						}

						for (index = timers.length; index--;) {
							if (timers[index].elem === this && (type == null || timers[index].queue === type)) {
								timers[index].anim.stop(gotoEnd);
								dequeue = false;
								timers.splice(index, 1);
							}
						}

						// start the next in the queue if the last step wasn't forced
						// timers currently will call their complete callbacks, which will dequeue
						// but only if they were gotoEnd
						if (dequeue || !gotoEnd) {
							JQXLite.dequeue(this, type);
						}
					});
				}
			});

			// Generate parameters to create a standard animation
			function genFx(type, includeWidth) {
				var which,
					attrs = { height: type },
					i = 0;

				// if we include width, step value is 1 to do all cssExpand values,
				// if we don't include width, step value is 2 to skip over Left and Right
				includeWidth = includeWidth ? 1 : 0;
				for (; i < 4; i += 2 - includeWidth) {
					which = cssExpand[i];
					attrs["margin" + which] = attrs["padding" + which] = type;
				}

				if (includeWidth) {
					attrs.opacity = attrs.width = type;
				}

				return attrs;
			}

			// Generate shortcuts for custom animations
			JQXLite.each({
				slideDown: genFx("show"),
				slideUp: genFx("hide"),
				slideToggle: genFx("toggle"),
				fadeIn: { opacity: "show" },
				fadeOut: { opacity: "hide" },
				fadeToggle: { opacity: "toggle" }
			}, function (name, props) {
				JQXLite.fn[name] = function (speed, easing, callback) {
					return this.animate(props, speed, easing, callback);
				};
			});

			JQXLite.speed = function (speed, easing, fn) {
				var opt = speed && typeof speed === "object" ? JQXLite.extend({}, speed) : {
					complete: fn || !fn && easing ||
						JQXLite.isFunction(speed) && speed,
					duration: speed,
					easing: fn && easing || easing && !JQXLite.isFunction(easing) && easing
				};

				opt.duration = JQXLite.fx.off ? 0 : typeof opt.duration === "number" ? opt.duration :
					opt.duration in JQXLite.fx.speeds ? JQXLite.fx.speeds[opt.duration] : JQXLite.fx.speeds._default;

				// normalize opt.queue - true/undefined/null -> "fx"
				if (opt.queue == null || opt.queue === true) {
					opt.queue = "fx";
				}

				// Queueing
				opt.old = opt.complete;

				opt.complete = function () {
					if (JQXLite.isFunction(opt.old)) {
						opt.old.call(this);
					}

					if (opt.queue) {
						JQXLite.dequeue(this, opt.queue);
					}
				};

				return opt;
			};

			JQXLite.easing = {
				linear: function (p) {
					return p;
				},
				swing: function (p) {
					return 0.5 - Math.cos(p * Math.PI) / 2;
				}
			};

			JQXLite.timers = [];
			JQXLite.fx = Tween.prototype.init;
			JQXLite.fx.tick = function () {
				var timer,
					timers = JQXLite.timers,
					i = 0;

				fxNow = JQXLite.now();

				for (; i < timers.length; i++) {
					timer = timers[i];
					// Checks the timer has not already been removed
					if (!timer() && timers[i] === timer) {
						timers.splice(i--, 1);
					}
				}

				if (!timers.length) {
					JQXLite.fx.stop();
				}
				fxNow = undefined;
			};

			JQXLite.fx.timer = function (timer) {
				if (timer() && JQXLite.timers.push(timer) && !timerId) {
					timerId = setInterval(JQXLite.fx.tick, JQXLite.fx.interval);
				}
			};

			JQXLite.fx.interval = 13;

			JQXLite.fx.stop = function () {
				clearInterval(timerId);
				timerId = null;
			};

			JQXLite.fx.speeds = {
				slow: 600,
				fast: 200,
				// Default speed
				_default: 400
			};

			// Back Compat <1.8 extension point
			JQXLite.fx.step = {};

			if (JQXLite.expr && JQXLite.expr.filters) {
				JQXLite.expr.filters.animated = function (elem) {
					return JQXLite.grep(JQXLite.timers, function (fn) {
						return elem === fn.elem;
					}).length;
				};
			}
			var rroot = /^(?:body|html)$/i;

			JQXLite.fn.offset = function (options) {
				if (arguments.length) {
					return options === undefined ?
						this :
						this.each(function (i) {
							JQXLite.offset.setOffset(this, options, i);
						});
				}

				var docElem, body, win, clientTop, clientLeft, scrollTop, scrollLeft,
					box = { top: 0, left: 0 },
					elem = this[0],
					doc = elem && elem.ownerDocument;

				if (!doc) {
					return;
				}

				if ((body = doc.body) === elem) {
					return JQXLite.offset.bodyOffset(elem);
				}

				docElem = doc.documentElement;

				// Make sure it's not a disconnected DOM node
				if (!JQXLite.contains(docElem, elem)) {
					return box;
				}

				// If we don't have gBCR, just use 0,0 rather than error
				// BlackBerry 5, iOS 3 (original iPhone)
				if (typeof elem.getBoundingClientRect !== "undefined") {
					box = elem.getBoundingClientRect();
				}
				win = getWindow(doc);
				clientTop = docElem.clientTop || body.clientTop || 0;
				clientLeft = docElem.clientLeft || body.clientLeft || 0;
				scrollTop = win.pageYOffset || docElem.scrollTop;
				scrollLeft = win.pageXOffset || docElem.scrollLeft;
				return {
					top: box.top + scrollTop - clientTop,
					left: box.left + scrollLeft - clientLeft
				};
			};

			JQXLite.offset = {

				bodyOffset: function (body) {
					var top = body.offsetTop,
						left = body.offsetLeft;

					if (JQXLite.support.doesNotIncludeMarginInBodyOffset) {
						top += parseFloat(JQXLite.css(body, "marginTop")) || 0;
						left += parseFloat(JQXLite.css(body, "marginLeft")) || 0;
					}

					return { top: top, left: left };
				},

				setOffset: function (elem, options, i) {
					var position = JQXLite.css(elem, "position");

					// set position first, in-case top/left are set even on static elem
					if (position === "static") {
						elem.style.position = "relative";
					}

					var curElem = JQXLite(elem),
						curOffset = curElem.offset(),
						curCSSTop = JQXLite.css(elem, "top"),
						curCSSLeft = JQXLite.css(elem, "left"),
						calculatePosition = (position === "absolute" || position === "fixed") && JQXLite.inArray("auto", [curCSSTop, curCSSLeft]) > -1,
						props = {}, curPosition = {}, curTop, curLeft;

					// need to be able to calculate position if either top or left is auto and position is either absolute or fixed
					if (calculatePosition) {
						curPosition = curElem.position();
						curTop = curPosition.top;
						curLeft = curPosition.left;
					} else {
						curTop = parseFloat(curCSSTop) || 0;
						curLeft = parseFloat(curCSSLeft) || 0;
					}

					if (JQXLite.isFunction(options)) {
						options = options.call(elem, i, curOffset);
					}

					if (options.top != null) {
						props.top = (options.top - curOffset.top) + curTop;
					}
					if (options.left != null) {
						props.left = (options.left - curOffset.left) + curLeft;
					}

					if ("using" in options) {
						options.using.call(elem, props);
					} else {
						curElem.css(props);
					}
				}
			};


			JQXLite.fn.extend({
				isRendered: function () {
					var that = this;
					var element = this[0];
					if (element.parentNode == null || (element.offsetWidth === 0 || element.offsetHeight === 0)) {
						return false;
					}

					return true;
				},

				getSizeFromStyle: function () {
					var that = this;
					var width = null;
					var height = null;
					var element = this[0];
					var computedStyle;

					if (element.style.width) {
						width = element.style.width;
					}
					if (element.style.height) {
						height = element.style.height;
					}

					if (window.getComputedStyle) {
						computedStyle = getComputedStyle(element, null);
					}
					else {
						computedStyle = element.currentStyle;
					}

					if (computedStyle) {
						if (computedStyle.width) {
							width = computedStyle.width;
						}
						if (computedStyle.height) {
							height = computedStyle.height;
						}
					}
					if (width === '0px') width = 0;
					if (height === '0px') height = 0;
					if (width === null) width = 0;
					if (height === null) height = 0;

					return { width: width, height: height };
				},

				initAnimate: function () {

				},

				sizeStyleChanged: function (resizeFn) {
					var that = this;

					var watchedElementData;

					var checkForChanges = function (mutations) {
						var data = watchedElementData;
						if (mutations && mutations[0] && mutations[0].attributeName === 'style' && mutations[0].type === 'attributes') {
							if (data.element.offsetWidth !== data.offsetWidth ||
								data.element.offsetHeight !== data.offsetHeight) {
								data.offsetWidth = data.element.offsetWidth;
								data.offsetHeight = data.element.offsetHeight;
								if (that.isRendered()) {
									data.callback();
								}
							}
						}
					}

					watchedElementData = {
						element: that[0],
						offsetWidth: that[0].offsetWidth,
						offsetHeight: that[0].offsetHeight,
						callback: resizeFn
					};

					try {
						if (!that.elementStyleObserver) {
							that.elementStyleObserver = new MutationObserver(checkForChanges);
							that.elementStyleObserver.observe(that[0], {
								attributes: true,
								childList: false,
								characterData: false
							});

						}
					}
					catch (error) { }
				},

				position: function () {
					if (!this[0]) {
						return;
					}

					var elem = this[0],

						// Get *real* offsetParent
						offsetParent = this.offsetParent(),

						// Get correct offsets
						offset = this.offset(),
						parentOffset = rroot.test(offsetParent[0].nodeName) ? { top: 0, left: 0 } : offsetParent.offset();

					// Subtract element margins
					// note: when an element has margin: auto the offsetLeft and marginLeft
					// are the same in Safari causing offset.left to incorrectly be 0
					offset.top -= parseFloat(JQXLite.css(elem, "marginTop")) || 0;
					offset.left -= parseFloat(JQXLite.css(elem, "marginLeft")) || 0;

					// Add offsetParent borders
					parentOffset.top += parseFloat(JQXLite.css(offsetParent[0], "borderTopWidth")) || 0;
					parentOffset.left += parseFloat(JQXLite.css(offsetParent[0], "borderLeftWidth")) || 0;

					// Subtract the two offsets
					return {
						top: offset.top - parentOffset.top,
						left: offset.left - parentOffset.left
					};
				},

				offsetParent: function () {
					return this.map(function () {
						var offsetParent = this.offsetParent || document.body;
						while (offsetParent && (!rroot.test(offsetParent.nodeName) && JQXLite.css(offsetParent, "position") === "static")) {
							offsetParent = offsetParent.offsetParent;
						}
						return offsetParent || document.body;
					});
				}
			});
			// Create scrollLeft and scrollTop methods
			JQXLite.each({ scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function (method, prop) {
				var top = /Y/.test(prop);

				JQXLite.fn[method] = function (val) {
					return JQXLite.access(this, function (elem, method, val) {
						var win = getWindow(elem);

						if (val === undefined) {
							return win ? (prop in win) ? win[prop] :
								win.document.documentElement[method] :
								elem[method];
						}

						if (win) {
							win.scrollTo(
								!top ? val : JQXLite(win).scrollLeft(),
								top ? val : JQXLite(win).scrollTop()
							);

						} else {
							elem[method] = val;
						}
					}, method, val, arguments.length, null);
				};
			});

			function getWindow(elem) {
				return JQXLite.isWindow(elem) ?
					elem :
					elem.nodeType === 9 ?
						elem.defaultView || elem.parentWindow :
						false;
			}
			// Create innerHeight, innerWidth, height, width, outerHeight and outerWidth methods
			JQXLite.each({ Height: "height", Width: "width" }, function (name, type) {
				JQXLite.each({ padding: "inner" + name, content: type, "": "outer" + name }, function (defaultExtra, funcName) {
					// margin is only for outerHeight, outerWidth
					JQXLite.fn[funcName] = function (margin, value) {
						var chainable = arguments.length && (defaultExtra || typeof margin !== "boolean"),
							extra = defaultExtra || (margin === true || value === true ? "margin" : "border");

						return JQXLite.access(this, function (elem, type, value) {
							var doc;

							if (JQXLite.isWindow(elem)) {
								// As of 5/8/2012 this will yield incorrect results for Mobile Safari, but there
								// isn't a whole lot we can do. See pull request at this URL for discussion:
								// https://github.com/jqx/jqx/pull/764
								return elem.document.documentElement["client" + name];
							}

							// Get document width or height
							if (elem.nodeType === 9) {
								doc = elem.documentElement;

								// Either scroll[Width/Height] or offset[Width/Height] or client[Width/Height], whichever is greatest
								// unfortunately, this causes bug #3838 in IE6/8 only, but there is currently no good, small way to fix it.
								return Math.max(
									elem.body["scroll" + name], doc["scroll" + name],
									elem.body["offset" + name], doc["offset" + name],
									doc["client" + name]
								);
							}

							return value === undefined ?
								// Get width or height on the element, requesting but not forcing parseFloat
								JQXLite.css(elem, type, value, extra) :

								// Set width or height on the element
								JQXLite.style(elem, type, value, extra);
						}, type, chainable ? margin : undefined, chainable, null);
					};
				});
			});
			// Expose JQXLite to the global object
			window.JQXLite = window.jqxHelper = JQXLite;

			// Expose JQXLite as an AMD module, but only for AMD loaders that
			// understand the issues with loading multiple versions of JQXLite
			// in a page that all might call define(). The loader will indicate
			// they have special allowances for multiple JQXLite versions by
			// specifying define.amd.JQXLite = true. Register as a named module,
			// since JQXLite can be concatenated with other files that may use define,
			// but not use a proper concatenation script that understands anonymous
			// AMD modules. A named AMD is safest and most robust way to register.
			// Lowercase jqx is used because AMD module names are derived from
			// file names, and JQXLite is normally delivered in a lowercase file name.
			// Do this after creating the global so that if an AMD module wants to call
			// noConflict to hide this version of JQXLite, it will work.
			if ( true && __webpack_require__.amdO.JQXLite) {
				!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = (function () { return JQXLite; }).apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
		__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
			}

		})(window);
	}

	// jqxHelper
	(function (window) {
		if (window.jqxCore) {
			window.$$ = window.minQuery = window.JQXLite;

			if (!window.$) {
				window.$ = window.minQuery;
			}

			return;
		}

		if (window.jQuery) {
			window.minQuery = window.JQXLite = window.jQuery;
			return;
		}

		if (!window.$) {
			window.$ = window.minQuery = window.JQXLite;
		}
		else {
			window.minQuery = window.JQXLite = window.$;
		}
	})(window);
	// End of jqxHelper

	JQXLite.generateID = function () {
		var S4 = function () {
			return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
		};

		var id = "";
		do {
			id = "jqx" + S4() + S4() + S4();
		} while ($('#' + id).length > 0);

		return id;
	}

	var jqxBaseFramework = window.jqxBaseFramework = window.minQuery || window.jQuery;

	(function ($) {

		$.jqx = $.jqx || {}
		window.jqx = $.jqx;

		var jqwidgets = {
			createInstance: function (selector, widgetName, params) {
				if (widgetName == 'jqxDataAdapter') {
					var source = params[0];
					var settings = params[1] || {};
					return new $.jqx.dataAdapter(source, settings);
				}

				$(selector)[widgetName](params || {});
				return $(selector)[widgetName]('getInstance');
			}
		};

		window.jqwidgets = jqwidgets;

		$.jqx.define = function (namespace, classname, baseclass) {
			namespace[classname] = function () {
				if (this.baseType) {
					this.base = new namespace[this.baseType]();
					this.base.defineInstance();
				}
				this.defineInstance();
				this.metaInfo();
			}

			namespace[classname].prototype.defineInstance = function () { };
			namespace[classname].prototype.metaInfo = function () { };
			namespace[classname].prototype.base = null;
			namespace[classname].prototype.baseType = undefined;

			if (baseclass && namespace[baseclass])
				namespace[classname].prototype.baseType = baseclass;
		}

		// method call
		$.jqx.invoke = function (object, args) {
			if (args.length == 0)
				return;

			var method = typeof (args) == Array || args.length > 0 ? args[0] : args;
			var methodArg = typeof (args) == Array || args.length > 1 ? Array.prototype.slice.call(args, 1) : $({}).toArray();

			while (object[method] == undefined && object.base != null) {
				if (object[method] != undefined && $.isFunction(object[method]))
					return object[method].apply(object, methodArg);

				if (typeof method == 'string') {
					var methodLowerCase = method.toLowerCase();
					if (object[methodLowerCase] != undefined && $.isFunction(object[methodLowerCase])) {
						return object[methodLowerCase].apply(object, methodArg);
					}
				}
				object = object.base;
			}

			if (object[method] != undefined && $.isFunction(object[method]))
				return object[method].apply(object, methodArg);

			if (typeof method == 'string') {
				var methodLowerCase = method.toLowerCase();
				if (object[methodLowerCase] != undefined && $.isFunction(object[methodLowerCase])) {
					return object[methodLowerCase].apply(object, methodArg);
				}
			}

			return;
		}

		$.jqx.getByPriority = function (arr) {
			var value = undefined;
			for (var i = 0; i < arr.length && value == undefined; i++) {
				if (value == undefined && arr[i] != undefined)
					value = arr[i];
			}

			return value;
		}

		$.jqx.hasProperty = function (obj, property) {
			if (typeof (property) == 'object') {
				for (var prop in property) {
					var o = obj;
					while (o) {
						if (o.hasOwnProperty(prop))
							return true;
						if (o.hasOwnProperty(prop.toLowerCase()))
							return true;
						o = o.base;
					}
					return false;
				}
			}
			else {
				while (obj) {
					if (obj.hasOwnProperty(property))
						return true;
					if (obj.hasOwnProperty(property.toLowerCase()))
						return true;
					obj = obj.base;
				}
			}

			return false;
		}

		$.jqx.hasFunction = function (object, args) {
			if (args.length == 0)
				return false;

			if (object == undefined)
				return false;

			var method = typeof (args) == Array || args.length > 0 ? args[0] : args;
			var methodArg = typeof (args) == Array || args.length > 1 ? Array.prototype.slice.call(args, 1) : {};

			while (object[method] == undefined && object.base != null) {
				if (object[method] && $.isFunction(object[method]))
					return true;

				if (typeof method == 'string') {
					var methodLowerCase = method.toLowerCase();
					if (object[methodLowerCase] && $.isFunction(object[methodLowerCase]))
						return true;
				}
				object = object.base;
			}

			if (object[method] && $.isFunction(object[method]))
				return true;

			if (typeof method == 'string') {
				var methodLowerCase = method.toLowerCase();
				if (object[methodLowerCase] && $.isFunction(object[methodLowerCase]))
					return true;
			}

			return false;
		}

		$.jqx.isPropertySetter = function (obj, args) {
			if (args.length == 1 && typeof (args[0]) == 'object')
				return true;

			if (args.length == 2 &&
				typeof (args[0]) == 'string' &&
				!$.jqx.hasFunction(obj, args)) {
				return true;
			}

			return false;
		}

		$.jqx.validatePropertySetter = function (obj, args, suppressException) {
			if (!$.jqx.propertySetterValidation)
				return true;

			if (args.length == 1 && typeof (args[0]) == 'object') {
				for (var i in args[0]) {
					var o = obj;
					while (!o.hasOwnProperty(i) && o.base)
						o = o.base;

					if (!o || !o.hasOwnProperty(i)) {
						if (!suppressException) {
							var hasLowerCase = o.hasOwnProperty(i.toString().toLowerCase());
							if (!hasLowerCase) {
								throw 'Invalid property: ' + i;
							}
							else return true;
						}
						return false;
					}
				}

				return true;
			}

			if (args.length != 2) {
				if (!suppressException)
					throw 'Invalid property: ' + args.length >= 0 ? args[0] : '';

				return false;
			}

			while (!obj.hasOwnProperty(args[0]) && obj.base)
				obj = obj.base;

			if (!obj || !obj.hasOwnProperty(args[0])) {
				if (!suppressException)
					throw 'Invalid property: ' + args[0];

				return false;
			}

			return true;
		}

		if (!Object.keys) {
			Object.keys = (function () {
				'use strict';
				var hasOwnProperty = Object.prototype.hasOwnProperty,
					hasDontEnumBug = !({ toString: null }).propertyIsEnumerable('toString'),
					dontEnums = [
						'toString',
						'toLocaleString',
						'valueOf',
						'hasOwnProperty',
						'isPrototypeOf',
						'propertyIsEnumerable',
						'constructor'
					],
					dontEnumsLength = dontEnums.length;

				return function (obj) {
					if (typeof obj !== 'object' && (typeof obj !== 'function' || obj === null)) {
						throw new TypeError('Object.keys called on non-object');
					}

					var result = [], prop, i;

					for (prop in obj) {
						if (hasOwnProperty.call(obj, prop)) {
							result.push(prop);
						}
					}

					if (hasDontEnumBug) {
						for (i = 0; i < dontEnumsLength; i++) {
							if (hasOwnProperty.call(obj, dontEnums[i])) {
								result.push(dontEnums[i]);
							}
						}
					}
					return result;
				};
			}());
		}

		$.jqx.set = function (object, args) {
			var newValuesLength = 0;
			if (args.length == 1 && typeof (args[0]) == 'object') {
				if (object.isInitialized && Object.keys && Object.keys(args[0]).length > 1) {
					var element = !object.base ? object.element : object.base.element;
					var initArgs = $.data(element, object.widgetName).initArgs;
					if (initArgs && JSON && JSON.stringify && args[0] && initArgs[0]) {
						try {
							if (JSON.stringify(args[0]) == JSON.stringify(initArgs[0])) {
								var toReturn = true;
								$.each(args[0], function (key, value) {
									if (object[key] != value) {
										toReturn = false;
										return false;
									}
								});
								if (toReturn) {
									return;
								}
							}
						}
						catch (err) {
						}
					}
					object.batchUpdate = args[0];
					var oldValues = {};
					var newValues = {};
					$.each(args[0], function (key, value) {
						var obj = object;
						while (!obj.hasOwnProperty(key) && obj.base != null)
							obj = obj.base;

						if (obj.hasOwnProperty(key)) {
							if (object[key] != value) {
								oldValues[key] = object[key];
								newValues[key] = value;
								newValuesLength++;
							}
						}
						else if (obj.hasOwnProperty(key.toLowerCase())) {
							if (object[key.toLowerCase()] != value) {
								oldValues[key.toLowerCase()] = object[key.toLowerCase()];
								newValues[key.toLowerCase()] = value;
								newValuesLength++;
							}
						}
					});
					if (newValuesLength < 2) {
						object.batchUpdate = null;
					}
				}

				$.each(args[0], function (key, value) {
					var obj = object;
					while (!obj.hasOwnProperty(key) && obj.base != null)
						obj = obj.base;

					if (obj.hasOwnProperty(key)) {
						$.jqx.setvalueraiseevent(obj, key, value);
					}
					else if (obj.hasOwnProperty(key.toLowerCase())) {
						$.jqx.setvalueraiseevent(obj, key.toLowerCase(), value);
					}
					else if ($.jqx.propertySetterValidation)
						throw "jqxCore: invalid property '" + key + "'";
				});

				if (object.batchUpdate != null) {
					object.batchUpdate = null;
					if (object.propertiesChangedHandler && newValuesLength > 1) {
						object.propertiesChangedHandler(object, oldValues, newValues);
					}
				}
			}
			else if (args.length == 2) {
				while (!object.hasOwnProperty(args[0]) && object.base)
					object = object.base;

				if (object.hasOwnProperty(args[0])) {
					$.jqx.setvalueraiseevent(object, args[0], args[1]);
				}
				else if (object.hasOwnProperty(args[0].toLowerCase())) {
					$.jqx.setvalueraiseevent(object, args[0].toLowerCase(), args[1]);
				}
				else if ($.jqx.propertySetterValidation)
					throw "jqxCore: invalid property '" + args[0] + "'";
			}
		}

		$.jqx.setvalueraiseevent = function (object, key, value) {
			var oldVal = object[key];

			object[key] = value;

			if (!object.isInitialized)
				return;

			if (object.propertyChangedHandler != undefined)
				object.propertyChangedHandler(object, key, oldVal, value);

			if (object.propertyChangeMap != undefined && object.propertyChangeMap[key] != undefined)
				object.propertyChangeMap[key](object, key, oldVal, value);
		};

		$.jqx.get = function (object, args) {
			if (args == undefined || args == null)
				return undefined;

			if (object.propertyMap) {
				var newVal = object.propertyMap(args);
				if (newVal != null)
					return newVal;
			}

			if (object.hasOwnProperty(args))
				return object[args];

			if (object.hasOwnProperty(args.toLowerCase()))
				return object[args.toLowerCase()];

			var arg = undefined;
			if (typeof (args) == Array) {
				if (args.length != 1)
					return undefined;
				arg = args[0];
			}
			else if (typeof (args) == 'string')
				arg = args;

			while (!object.hasOwnProperty(arg) && object.base)
				object = object.base;

			if (object)
				return object[arg];

			return undefined;
		}

		$.jqx.serialize = function (obj) {
			var txt = '';
			if ($.isArray(obj)) {
				txt = '['
				for (var i = 0; i < obj.length; i++) {
					if (i > 0)
						txt += ', ';
					txt += $.jqx.serialize(obj[i]);
				}
				txt += ']';
			}
			else if (typeof (obj) == 'object') {
				txt = '{';
				var j = 0;
				for (var i in obj) {
					if (j++ > 0)
						txt += ', ';
					txt += i + ': ' + $.jqx.serialize(obj[i]);
				}
				txt += '}';
			}
			else
				txt = obj.toString();

			return txt;
		}

		$.jqx.propertySetterValidation = true;

		$.jqx.jqxWidgetProxy = function (controlName, element, args) {
			var host = $(element);
			var vars = $.data(element, controlName);
			if (vars == undefined) {
				return undefined;
			}

			var obj = vars.instance;

			if ($.jqx.hasFunction(obj, args))
				return $.jqx.invoke(obj, args);

			if ($.jqx.isPropertySetter(obj, args)) {
				if ($.jqx.validatePropertySetter(obj, args)) {
					$.jqx.set(obj, args);
					return undefined;
				}
			} else {
				if (typeof (args) == 'object' && args.length == 0)
					return;
				else if (typeof (args) == 'object' && args.length == 1 && $.jqx.hasProperty(obj, args[0]))
					return $.jqx.get(obj, args[0]);
				else if (typeof (args) == 'string' && $.jqx.hasProperty(obj, args[0]))
					return $.jqx.get(obj, args);
			}

			throw "jqxCore: Invalid parameter '" + $.jqx.serialize(args) + "' does not exist.";
			//      return undefined;
		}

		$.jqx.applyWidget = function (element, controlName, args, instance) {
			var WinJS = false;
			try {
				WinJS = window.MSApp != undefined;
			}
			catch (e) {
			}

			var host = $(element);
			if (!instance) {
				instance = new $.jqx['_' + controlName]();
			}
			else {
				instance.host = host;
				instance.element = element;
			}
			if (element.id == "") {
				element.id = $.jqx.utilities.createId();
			}

			var vars = { host: host, element: element, instance: instance, initArgs: args };

			instance.widgetName = controlName;
			$.data(element, controlName, vars);
			$.data(element, 'jqxWidget', vars.instance);

			var inits = new Array();
			var instance = vars.instance;
			while (instance) {
				instance.isInitialized = false;
				inits.push(instance);
				instance = instance.base;
			}
			inits.reverse();
			inits[0].theme = $.jqx.theme || '';

			$.jqx.jqxWidgetProxy(controlName, element, args);

			for (var i in inits) {
				instance = inits[i];
				if (i == 0) {
					instance.host = host;
					instance.element = element;
					instance.WinJS = WinJS;
				}
				if (instance != undefined) {
					if (instance.definedInstance) {
						instance.definedInstance();
					}
					if (instance.createInstance != null) {
						if (WinJS) {
							MSApp.execUnsafeLocalFunction(function () {
								instance.createInstance(args);
							});
						}
						else {
							instance.createInstance(args);
						}
					}
				}
			}

			for (var i in inits) {
				if (inits[i] != undefined) {
					inits[i].isInitialized = true;
				}
			}

			if (WinJS) {
				MSApp.execUnsafeLocalFunction(function () {
					vars.instance.refresh(true);
				});
			}
			else {
				vars.instance.refresh(true);
			}

		}

		$.jqx.jqxWidget = function (name, base, params) {

			var WinJS = false;
			try {
				var jqxArgs = Array.prototype.slice.call(params, 0);
			}
			catch (e) {
				var jqxArgs = '';
			}

			try {
				WinJS = window.MSApp != undefined;
			}
			catch (e) {
			}

			var controlName = name;

			var baseControl = '';
			if (base)
				baseControl = '_' + base;
			$.jqx.define($.jqx, '_' + controlName, baseControl);

			var widgets = new Array();

			if (!window[controlName]) {
				var serializeObject = function (data) {
					if (data == null) return "";
					var dataType = $.type(data);
					switch (dataType) {
						case "string":
						case "number":
						case "date":
						case "boolean":
						case "bool":
							if (data === null)
								return "";
							return data.toString()
					}

					var str = "";
					$.each(data, function (index, value) {
						var val = value;
						if (index > 0) str += ', ';
						str += "[";
						var m = 0;

						if ($.type(val) == "object") {
							for (var obj in val) {
								if (m > 0) str += ', ';
								str += '{' + obj + ":" + val[obj] + '}';
								m++;
							}
						}
						else {
							if (m > 0) str += ', ';
							str += '{' + index + ":" + val + '}';
							m++;
						}

						str += "]";
					});
					return str;
				}

				jqwidgets[controlName] = window[controlName] = function (selector, params) {
					var args = [];
					if (!params) {
						params = {};
					}
					args.push(params);

					var uid = selector;
					if ($.type(uid) === "object" && selector[0]) {
						uid = selector[0].id;
						if (uid === "") {
							uid = selector[0].id = $.jqx.utilities.createId();
						}
					} else if ($.type(selector) === "object" && selector && selector.nodeName) {
						uid = selector.id;
						if (uid === "") {
							uid = selector.id = $.jqx.utilities.createId();
						}
					}

					if (window.jqxWidgets && window.jqxWidgets[uid]) {
						if (params) {
							$.each(window.jqxWidgets[uid], function (index) {
								var data = $(this.element).data();
								if (data && data.jqxWidget) {
									$(this.element)[controlName](params);
								}
							});
						}
						if (window.jqxWidgets[uid].length == 1) {
							var data = $(window.jqxWidgets[uid][0].widgetInstance.element).data();
							if (data && data.jqxWidget) {
								return window.jqxWidgets[uid][0];
							}
						}

						var data = $(window.jqxWidgets[uid][0].widgetInstance.element).data();
						if (data && data.jqxWidget) {
							return window.jqxWidgets[uid];
						}
					}

					var elements = $(selector);
					if (elements.length === 0) {
						elements = $("<div></div>");
						if (controlName === "jqxInput" || controlName === "jqxPasswordInput" || controlName === "jqxMaskedInput") {
							elements = $("<input/>");
						}
						if (controlName === "jqxTextArea") {
							elements = $("<textarea></textarea>");
						}
						if (controlName === "jqxButton" || controlName === "jqxRepeatButton" || controlName === "jqxToggleButton") {
							elements = $("<button/>");
						}
						if (controlName === "jqxSplitter") {
							elements = $("<div><div>Panel 1</div><div>Panel 2</div></div>");
						}
						if (controlName === "jqxTabs") {
							elements = $("<div><ul><li>Tab 1</li><li>Tab 2</li></ul><div>Content 1</div><div>Content 2</div></div>");
						}
						if (controlName === "jqxRibbon") {
							elements = $("<div><ul><li>Tab 1</li><li>Tab 2</li></ul><div><div>Content 1</div><div>Content 2</div></div></div>");
						}
						if (controlName === "jqxDocking") {
							elements = $("<div><div><div><div>Title 1</div><div>Content 1</div></div></div></div>");
						}
						if (controlName === "jqxWindow") {
							elements = $("<div><div>Title 1</div><div>Content 1</div></div>");
						}
					}
					var instances = [];


					$.each(elements, function (index) {
						var element = elements[index];
						$.jqx.applyWidget(element, controlName, args, undefined);
						if (!widgets[controlName]) {
							var instance = $.data(element, 'jqxWidget');
							var properties = $.jqx["_" + controlName].prototype.defineInstance();
							var metaInfo = {};

							if ($.jqx["_" + controlName].prototype.metaInfo) {
								metaInfo = $.jqx["_" + controlName].prototype.metaInfo();
							}

							if (controlName == "jqxDockingLayout") {
								properties = $.extend(properties, $.jqx["_jqxLayout"].prototype.defineInstance());
							}
							if (controlName == "jqxToggleButton" || controlName == "jqxRepeatButton") {
								properties = $.extend(properties, $.jqx["_jqxButton"].prototype.defineInstance());
							}
							if (controlName == "jqxTreeGrid") {
								properties = $.extend(properties, $.jqx["_jqxDataTable"].prototype.defineInstance());
							}

							var widgetConstructor = function (element) {
								var instance = $.data(element, 'jqxWidget');
								this.widgetInstance = instance;
								var widget = $.extend(this, instance);
								widget.on = widget.addEventListener = function (eventName, callback) {
									widget.addHandler(!widget.base ? widget.host : widget.base.host, eventName, callback);
								}
								widget.off = widget.removeEventListener = function (eventName) {
									widget.removeHandler(!widget.base ? widget.host : widget.base.host, eventName);
								}

								for (var obj in instance) {
									if ($.type(instance[obj]) == "function") {
										widget[obj] = $.proxy(instance[obj], instance);
									}
								}
								return widget;
							}
							widgets[controlName] = widgetConstructor;

							// widget properties
							$.each(properties, function (property, currentValue) {
								Object.defineProperty(widgetConstructor.prototype, property, {
									get: function () {
										if (this.widgetInstance) {
											return this.widgetInstance[property];
										}
										return currentValue;
									},
									set: function (newValue) {
										if (this.widgetInstance && (this.widgetInstance[property] != newValue || property === "width" || property === "height")) {
											var key1 = this.widgetInstance[property];
											var key2 = newValue;
											var dataType1 = $.type(key1);
											var dataType2 = $.type(key2);
											var differentTypes = false;
											if (dataType1 != dataType2 || property === "source" || property === "width" || property === "height") {
												differentTypes = true;
											}
											if (differentTypes || (serializeObject(key1) != serializeObject(key2))) {
												var settings = {};
												settings[property] = newValue;
												if (this.widgetInstance.host) {
													this.widgetInstance.host[controlName](settings);
												}
												else {
													this.widgetInstance.base.host[controlName](settings);
												}
												this.widgetInstance[property] = newValue;
												if (this.widgetInstance.propertyUpdated) {
													this.widgetInstance.propertyUpdated(property, key1, newValue);
												}
											}
										}
									}
								});
							});
						}
						var instance = new widgets[controlName](element);

						instances.push(instance);
						if (!window.jqxWidgets) {
							window.jqxWidgets = new Array();
						}
						if (!window.jqxWidgets[uid]) {
							window.jqxWidgets[uid] = new Array();
						}
						window.jqxWidgets[uid].push(instance);
					});

					if (instances.length === 1)
						return instances[0];

					return instances;

				}
			}

			$.fn[controlName] = function () {
				var args = Array.prototype.slice.call(arguments, 0);

				if (args.length == 0 || (args.length == 1 && typeof (args[0]) == 'object')) {
					if (this.length == 0) {
						if (this.selector) {
							throw new Error('Invalid Selector - ' + this.selector + '! Please, check whether the used ID or CSS Class name is correct.');
						}
						else {
							throw new Error('Invalid Selector! Please, check whether the used ID or CSS Class name is correct.');
						}
					}

					return this.each(function () {
						var host = $(this);
						var element = this; // element == this == host[0]
						var vars = $.data(element, controlName);

						if (vars == null) {
							$.jqx.applyWidget(element, controlName, args, undefined);
						}
						else {
							$.jqx.jqxWidgetProxy(controlName, this, args);
						}
					}); // each
				}
				else {
					if (this.length == 0) {
						if (this.selector) {
							throw new Error('Invalid Selector - ' + this.selector + '! Please, check whether the used ID or CSS Class name is correct.');
						}
						else {
							throw new Error('Invalid Selector! Please, check whether the used ID or CSS Class name is correct.');
						}
					}

					var returnVal = null;

					var cnt = 0;
					this.each(function () {
						var result = $.jqx.jqxWidgetProxy(controlName, this, args);

						if (cnt == 0) {
							returnVal = result;
							cnt++;
						}
						else {
							if (cnt == 1) {
								var tmp = [];
								tmp.push(returnVal);
								returnVal = tmp;
							}
							returnVal.push(result);
						}
					}); // each
				}

				return returnVal;
			}

			try {
				$.extend($.jqx['_' + controlName].prototype, Array.prototype.slice.call(params, 0)[0]);
			}
			catch (e) {
			}

			$.extend($.jqx['_' + controlName].prototype, {
				toThemeProperty: function (propertyName, override) {
					return $.jqx.toThemeProperty(this, propertyName, override);
				},

				isMaterialized: function () {
					if (!this.theme) {
						return false;
					}

					if (this.theme === "fluent") {
						return true;
					}

					if (this.theme === "light") {
						return true;
					}


					if (this.theme === "dark") {
						return true;
					}

					if (this.theme === "deepblue") {
						return true;
					}

					if (this.theme.indexOf("material") >= 0) {
						return true;
					}
				},

				isModern: function () {
					if (!this.theme) {
						return false;
					}

					if (this.theme.indexOf("light") >= 0) {
						return true;
					}

					if (this.theme === "dark") {
						return true;
					}
				},

				_addBarAndLabel: function (host) {
					var that = this;

					var label = $("<label></label");
					label[0].innerHTML = this.placeHolder;
					label.addClass(that.toThemeProperty('jqx-input-label'));
					host.after(label);
					that.label = label;

					var bar = $("<span></span>");
					host.after(bar);
					bar.addClass(that.toThemeProperty('jqx-input-bar'));
					that.bar = bar;
					that.bar.css('top', this.host.height());
				}
			});

			$.jqx['_' + controlName].prototype.refresh = function () {
				if (this.base)
					this.base.refresh(true);
			}
			$.jqx['_' + controlName].prototype.createInstance = function () {
			}

			$.jqx.isPassiveSupported = function () {
				var that = this;

				if (that.supportsPassive !== undefined) {
					return that.supportsPassive;
				}

				that.supportsPassive = false;
				try {
					var opts = Object.defineProperty({
					}, 'passive', {
						// eslint-disable-next-line getter-return
						get: function () {
							that.supportsPassive = true;
						}
					});
					window.addEventListener('testPassive', null, opts);
					window.removeEventListener('testPassive', null, opts);
				}
				catch (e) {
					//
				}

				return that.supportsPassive;
			}

			$.jqx['_' + controlName].prototype.addEventHandler = function (event, fnHandler) {
				if (this.base) {
					this.base.host.on(event, fnHandler);
				}
				else {
					this.host.on(event, fnHandler);
				}
			}

			$.jqx['_' + controlName].prototype.removeEventHandler = function (event, fnHandler) {
				if (this.base) {
					this.base.host.off(event);
				}
				else {
					this.host.off(event);
				}
			}

			$.jqx['_' + controlName].prototype.applyTo = function (element, args) {
				if (!(args instanceof Array)) {
					var a = [];
					a.push(args);
					args = a;
				}

				$.jqx.applyWidget(element, controlName, args, this);
			}

			$.jqx['_' + controlName].prototype.getInstance = function () {
				return this;
			}
			$.jqx['_' + controlName].prototype.propertyChangeMap = {};

			$.jqx['_' + controlName].prototype.addHandler = function (source, events, func, data) {
				$.jqx.addHandler($(source), events, func, data);
			};

			$.jqx['_' + controlName].prototype.removeHandler = function (source, events, func) {
				$.jqx.removeHandler($(source), events, func);
			};

			$.jqx['_' + controlName].prototype.setOptions = function () {
				if (!this.host || !this.host.length || this.host.length != 1)
					return;

				return $.jqx.jqxWidgetProxy(controlName, this.host[0], arguments);
			};
		} // jqxWidget

		$.jqx.toThemeProperty = function (instance, propertyName, override) {
			if (instance.theme == '')
				return propertyName;

			var split = propertyName.split(' ');
			var result = '';
			for (var i = 0; i < split.length; i++) {
				if (i > 0)
					result += ' ';

				var key = split[i];

				if (override != null && override)
					result += key + '-' + instance.theme;
				else
					result += key + ' ' + key + '-' + instance.theme;
			}

			return result;
		}

		$.jqx.addHandler = function (source, eventsList, func, data) {
			var events = eventsList.split(' ');

			for (var i = 0; i < events.length; i++) {
				var event = events[i];

				if (window.addEventListener && source[0]) {
					switch (event) {
						case 'mousewheel':
							if ($.jqx.browser.mozilla) {
								source[0].addEventListener('DOMMouseScroll', func, $.jqx.isPassiveSupported() ? { passive: false } : false);
							}
							else {
								source[0].addEventListener('mousewheel', func, $.jqx.isPassiveSupported() ? { passive: false } : false);
							}
							continue;
						case 'mousemove':
							if (!data) {
								source[0].addEventListener('mousemove', func, false);
								continue;
							}
							break;
						case 'touchmove':
							if (!data) {
								source[0].addEventListener('touchmove', func, false);
								continue;
							}
							else if (data && data.passive) {
								source[0].addEventListener('touchmove', func, data);
								continue;
							}

							break;
					}
				}

				if (data == undefined || data == null) {
					if (source.on)
						source.on(event, func);
					else
						source.bind(event, func);
				}
				else {
					if (source.on)
						source.on(event, data, func);
					else
						source.bind(event, data, func);
				}
			} // for
		};

		$.jqx.removeHandler = function (source, eventsList, func) {
			if (!eventsList) {
				if (source.off)
					source.off();
				else
					source.unbind();
				return;
			}
			var events = eventsList.split(' ');

			for (var i = 0; i < events.length; i++) {
				var event = events[i];

				if (window.removeEventListener) {
					switch (event) {
						case 'mousewheel':
							if ($.jqx.browser.mozilla) {
								source[0].removeEventListener('DOMMouseScroll', func, false);
							}
							else {
								source[0].removeEventListener('mousewheel', func, false);
							}
							continue;
						case 'mousemove':
							if (func) {
								source[0].removeEventListener('mousemove', func, false);
								continue;
							}
							break;
						case 'touchmove':
							if (func) {
								source[0].removeEventListener('touchmove', func, false);
								continue;
							}
							break;
					}
				}

				if (event == undefined) {
					if (source.off)
						source.off();
					else
						source.unbind();
					continue;
				}

				if (func == undefined) {
					if (source.off)
						source.off(event);
					else
						source.unbind(event);
				}
				else {
					if (source.off)
						source.off(event, func);
					else
						source.unbind(event, func);
				}
			}
		};

		$.jqx.credits = $.jqx.credits || "";
		$.jqx.theme = $.jqx.theme || "";
		$.jqx.scrollAnimation = $.jqx.scrollAnimation || false;
		$.jqx.resizeDelay = $.jqx.resizeDelay || 10;

		$.jqx.ready = function () {
			$(window).trigger('jqxReady');
		}
		$.jqx.init = function () {
			$.each(arguments[0], function (index, value) {
				if (index == "theme") {
					$.jqx.theme = value;
				}
				if (index == "scrollBarSize") {
					$.jqx.utilities.scrollBarSize = value;
				}
				if (index == "touchScrollBarSize") {
					$.jqx.utilities.touchScrollBarSize = value;
				}
				if (index == "scrollBarButtonsVisibility") {
					$.jqx.utilities.scrollBarButtonsVisibility = value;
				}
			});
		}

		// Utilities
		$.jqx.utilities = $.jqx.utilities || {};
		$.extend($.jqx.utilities,
			{
				scrollBarSize: 13,
				touchScrollBarSize: 8,
				scrollBarButtonsVisibility: "visible",
				createId: function () {
					var S4 = function () {
						return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
					};
					return "jqxWidget" + S4() + S4() + S4();
				},

				setTheme: function (oldTheme, theme, element) {
					if (typeof element === 'undefined') {
						return;
					}

					if (!element[0].className.split) {
						return;
					}

					if (oldTheme === undefined) {
						oldTheme = '';
					}

					if (theme === undefined) {
						theme = '';
					}

					var classNames = element[0].className.split(' '),
						oldClasses = [], newClasses = [],
						children = element.children();
					for (var i = 0; i < classNames.length; i += 1) {
						if (classNames[i].indexOf(oldTheme) >= 0) {
							if (oldTheme.length > 0) {
								oldClasses.push(classNames[i]);
								newClasses.push(classNames[i].replace(oldTheme, theme));
							}
							else {
								newClasses.push(classNames[i].replace("-" + theme, "") + '-' + theme);
							}
						}
					}
					this._removeOldClasses(oldClasses, element);
					this._addNewClasses(newClasses, element);
					for (var i = 0; i < children.length; i += 1) {
						this.setTheme(oldTheme, theme, $(children[i]));
					}
				},

				_removeOldClasses: function (classes, element) {
					for (var i = 0; i < classes.length; i += 1) {
						element.removeClass(classes[i]);
					}
				},

				_addNewClasses: function (classes, element) {
					for (var i = 0; i < classes.length; i += 1) {
						element.addClass(classes[i]);
					}
				},

				getOffset: function (el) {
					var left = $.jqx.mobile.getLeftPos(el[0]);
					var top = $.jqx.mobile.getTopPos(el[0]);
					return { top: top, left: left };
				},

				resize: function (element, callback, destroy, checkForHidden) {
					if (checkForHidden === undefined) {
						checkForHidden = true;
					}

					var index = -1;
					var that = this;
					var getHiddenIndex = function (element) {
						if (!that.hiddenWidgets) {
							return -1;
						}

						var hiddenIndex = -1;
						for (var i = 0; i < that.hiddenWidgets.length; i++) {
							if (element.id) {
								if (that.hiddenWidgets[i].id == element.id) {
									hiddenIndex = i;
									break;
								}
							}
							else {
								if (that.hiddenWidgets[i].id == element[0].id) {
									hiddenIndex = i;
									break;
								}
							}
						}
						return hiddenIndex;
					}


					if (this.resizeHandlers) {
						for (var i = 0; i < this.resizeHandlers.length; i++) {
							if (element.id) {
								if (this.resizeHandlers[i].id == element.id) {
									index = i;
									break;
								}
							}
							else {
								if (this.resizeHandlers[i].id == element[0].id) {
									index = i;
									break;
								}
							}
						}

						if (destroy === true) {
							if (index != -1) {
								this.resizeHandlers.splice(index, 1);
								if (this.watchedElementData && this.watchedElementData.length > 0) {
									this.watchedElementData.splice(index, 1);
								}
							}

							if (this.resizeHandlers.length == 0) {
								var w = $(window);
								if (w.off) {
									w.off('resize.jqx');
									w.off('orientationchange.jqx');
									w.off('orientationchanged.jqx');
								}
								else {
									w.unbind('resize.jqx');
									w.unbind('orientationchange.jqx');
									w.unbind('orientationchanged.jqx');
								}
								this.resizeHandlers = null;
							}
							var hiddenIndex = getHiddenIndex(element);
							if (hiddenIndex != -1 && this.hiddenWidgets) {
								this.hiddenWidgets.splice(hiddenIndex, 1);
							}
							return;
						}
					}
					else if (destroy === true) {
						var hiddenIndex = getHiddenIndex(element);
						if (hiddenIndex != -1 && this.hiddenWidgets) {
							this.hiddenWidgets.splice(hiddenIndex, 1);
						}
						return;
					}
					var that = this;
					var doResize = function (isHidden, type) {
						if (!that.resizeHandlers)
							return;

						var getParentsCount = function (element) {
							var index = -1;
							var parent = element.parentNode;
							while (parent) {
								index++;
								parent = parent.parentNode;
							}
							return index;
						}

						var compare = function (value1, value2) {
							if (!value1.widget || !value2.widget)
								return 0;

							var parents1 = getParentsCount(value1.widget[0]);
							var parents2 = getParentsCount(value2.widget[0]);

							try {
								if (parents1 < parents2) { return -1; }
								if (parents1 > parents2) { return 1; }
							}
							catch (error) {
								var er = error;
							}

							return 0;
						};
						var handleHiddenWidgets = function (delay) {
							if (that.hiddenWidgets.length > 0) {
								that.hiddenWidgets.sort(compare);
								var updateHiddenWidgets = function () {
									var hasHiddenWidget = false;
									var currentHiddenWidgets = new Array();
									for (var p = 0; p < that.hiddenWidgets.length; p++) {
										var handler = that.hiddenWidgets[p];
										if ($.jqx.isHidden(handler.widget)) {
											hasHiddenWidget = true;
											currentHiddenWidgets.push(handler);
										}
										else {
											if (handler.callback) {
												handler.callback(type);
											}
										}
									}
									that.hiddenWidgets = currentHiddenWidgets;
									if (!hasHiddenWidget) {
										clearInterval(that.__resizeInterval);
									}
								}
								if (delay == false) {
									updateHiddenWidgets();
									if (that.__resizeInterval) clearInterval(that.__resizeInterval);
									return;
								}
								if (that.__resizeInterval) clearInterval(that.__resizeInterval);
								that.__resizeInterval = setInterval(function () {
									updateHiddenWidgets();
								}, 100);
							}
						}

						if (that.hiddenWidgets && that.hiddenWidgets.length > 0) {
							handleHiddenWidgets(false);
						}
						that.hiddenWidgets = new Array();
						that.resizeHandlers.sort(compare);
						for (var i = 0; i < that.resizeHandlers.length; i++) {
							var handler = that.resizeHandlers[i];
							var widget = handler.widget;
							var data = handler.data;
							if (!data) continue;
							if (!data.jqxWidget) continue;

							var width = data.jqxWidget.width;
							var height = data.jqxWidget.height;

							if (data.jqxWidget.base) {
								if (width == undefined) {
									width = data.jqxWidget.base.width;
								}
								if (height == undefined) {
									height = data.jqxWidget.base.height;
								}
							}

							if (width === undefined && height === undefined) {
								width = data.jqxWidget.element.style.width;
								height = data.jqxWidget.element.style.height;
							}

							var percentageSize = false;
							if (width != null && width.toString().indexOf("%") != -1) {
								percentageSize = true;
							}

							if (height != null && height.toString().indexOf("%") != -1) {
								percentageSize = true;
							}

							if ($.jqx.isHidden(widget)) {
								if (getHiddenIndex(widget) === -1) {
									if (percentageSize || isHidden === true) {
										if (handler.data.nestedWidget !== true) {
											that.hiddenWidgets.push(handler);
										}
									}
								}
							}
							else if (isHidden === undefined || isHidden !== true) {
								if (percentageSize) {
									handler.callback(type);
									if (that.watchedElementData) {
										for (var m = 0; m < that.watchedElementData.length; m++) {
											if (that.watchedElementData[m].element == data.jqxWidget.element) {
												that.watchedElementData[m].offsetWidth = data.jqxWidget.element.offsetWidth;
												that.watchedElementData[m].offsetHeight = data.jqxWidget.element.offsetHeight;
												break;
											}
										}
									}
									if (that.hiddenWidgets.indexOf(handler) >= 0) {
										that.hiddenWidgets.splice(that.hiddenWidgets.indexOf(handler), 1);
									}
								}
								if (data.jqxWidget.element) {
									var widgetClass = data.jqxWidget.element.className;
									if (widgetClass.indexOf('dropdownlist') >= 0 || widgetClass.indexOf('datetimeinput') >= 0 || widgetClass.indexOf('combobox') >= 0 || widgetClass.indexOf('menu') >= 0) {
										if (data.jqxWidget.isOpened) {
											var opened = data.jqxWidget.isOpened();
											if (opened) {
												if (type && type == "resize" && $.jqx.mobile.isTouchDevice())
													continue;

												data.jqxWidget.close();
											}
										}
									}
								}
							}
						};

						handleHiddenWidgets();
					}

					if (!this.resizeHandlers) {
						this.resizeHandlers = new Array();

						var w = $(window);
						if (w.on) {
							this._resizeTimer = null;
							this._initResize = null;
							w.on('resize.jqx', function (event) {
								if (that._resizeTimer != undefined) {
									clearTimeout(that._resizeTimer);
								}
								if (!that._initResize) {
									that._initResize = true;
									doResize(null, 'resize');
								}
								else {
									that._resizeTimer = setTimeout(function () {
										doResize(null, 'resize');
									}, $.jqx.resizeDelay);
								}
							});
							w.on('orientationchange.jqx', function (event) {
								doResize(null, 'orientationchange');
							});
							w.on('orientationchanged.jqx', function (event) {
								doResize(null, 'orientationchange');
							});
						}
						else {
							w.bind('resize.jqx', function (event) {
								doResize(null, 'orientationchange');
							});
							w.bind('orientationchange.jqx', function (event) {
								doResize(null, 'orientationchange');
							});
							w.bind('orientationchanged.jqx', function (event) {
								doResize(null, 'orientationchange');
							});
						}
					}
					var elementData = element.data();
					if (checkForHidden) {
						if (index === -1) {
							this.resizeHandlers.push({ id: element[0].id, widget: element, callback: callback, data: elementData });
						}
					}
					try {
						var width = elementData.jqxWidget.width;
						var height = elementData.jqxWidget.height;

						if (elementData.jqxWidget.base) {
							if (width == undefined) {
								width = elementData.jqxWidget.base.width;
							}
							if (height == undefined) {
								height = elementData.jqxWidget.base.height;
							}
						}

						if (width === undefined && height === undefined) {
							width = elementData.jqxWidget.element.style.width;
							height = elementData.jqxWidget.element.style.height;
						}

						var percentageSize = false;
						if (width != null && width.toString().indexOf("%") != -1) {
							percentageSize = true;
						}

						if (height != null && height.toString().indexOf("%") != -1) {
							percentageSize = true;
						}
						if (percentageSize) {
							if (!this.watchedElementData) {
								this.watchedElementData = [];
							}
							var that = this;
							var checkForChanges = function (mutations) {
								if (that.watchedElementData.forEach) {
									that.watchedElementData.forEach(function (data) {
										if (data.element.offsetWidth !== data.offsetWidth ||
											data.element.offsetHeight !== data.offsetHeight) {
											data.offsetWidth = data.element.offsetWidth;
											data.offsetHeight = data.element.offsetHeight;
											if (data.timer) {
												clearTimeout(data.timer);
											}
											data.timer = setTimeout(function () {
												if (!$.jqx.isHidden($(data.element))) {
													data.callback();
												}
												else {
													data.timer = setInterval(function () {
														if (!$.jqx.isHidden($(data.element))) {
															clearInterval(data.timer);
															data.callback();
														}
													}, 100);
												}
											});
										}
									});
								}
							};

							that.watchedElementData.push({
								element: element[0],
								offsetWidth: element[0].offsetWidth,
								offsetHeight: element[0].offsetHeight,
								callback: callback
							});
							if (!that.observer) {
								that.observer = new MutationObserver(checkForChanges);
								that.observer.observe(document.body, {
									attributes: true,
									childList: true,
									characterData: true
								});
							}
						}
					}
					catch (er) {
					}
					if ($.jqx.isHidden(element) && checkForHidden === true) {
						doResize(true);
					}
					$.jqx.resize = function () {
						doResize(null, 'resize');
					}
				},

				parseJSON: function (data) {
					if (!data || typeof data !== "string") {
						return null;
					}
					var rvalidchars = /^[\],:{}\s]*$/,
						rvalidbraces = /(?:^|:|,)(?:\s*\[)+/g,
						rvalidescape = /\\(?:["\\\/bfnrt]|u[\da-fA-F]{4})/g,
						rvalidtokens = /"[^"\\\r\n]*"|true|false|null|-?(?:\d\d*\.|)\d+(?:[eE][\-+]?\d+|)/g;

					// Make sure leading/trailing whitespace is removed (IE can't handle it)
					data = $.trim(data);

					// Attempt to parse using the native JSON parser first
					if (window.JSON && window.JSON.parse) {
						return window.JSON.parse(data);
					}

					// Make sure the incoming data is actual JSON
					// Logic borrowed from http://json.org/json2.js
					if (rvalidchars.test(data.replace(rvalidescape, "@")
						.replace(rvalidtokens, "]")
						.replace(rvalidbraces, ""))) {

						return (new Function("return " + data))();

					}
					throw new Error("Invalid JSON: " + data);
				},

				html: function (element, value) {
					if (!$(element).on || !$.access) {
						return $(element).html(value);
					}
					try {	
						return $.access(element, function (value) {
							var elem = element[0] || {},
								i = 0,
								l = element.length;

							if (value === undefined) {
								return elem.nodeType === 1 ?
									elem.innerHTML.replace(rinlinejQuery, "") :
									undefined;
							}

							var rnoInnerhtml = /<(?:script|style|link)/i,
								nodeNames = "abbr|article|aside|audio|bdi|canvas|data|datalist|details|figcaption|figure|footer|" +
									"header|hgroup|mark|meter|nav|output|progress|section|summary|time|video",
								rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,
								rtagName = /<([\w:]+)/,
								rnocache = /<(?:script|object|embed|option|style)/i,
								rnoshimcache = new RegExp("<(?:" + nodeNames + ")[\\s/>]", "i"),
								rleadingWhitespace = /^\s+/,
								wrapMap = {
									option: [1, "<select multiple='multiple'>", "</select>"],
									legend: [1, "<fieldset>", "</fieldset>"],
									thead: [1, "<table>", "</table>"],
									tr: [2, "<table><tbody>", "</tbody></table>"],
									td: [3, "<table><tbody><tr>", "</tr></tbody></table>"],
									col: [2, "<table><tbody></tbody><colgroup>", "</colgroup></table>"],
									area: [1, "<map>", "</map>"],
									_default: [0, "", ""]
								};

							if (typeof value === "string" && !rnoInnerhtml.test(value) &&
								($.support.htmlSerialize || !rnoshimcache.test(value)) &&
								($.support.leadingWhitespace || !rleadingWhitespace.test(value)) &&
								!wrapMap[(rtagName.exec(value) || ["", ""])[1].toLowerCase()]) {

								value = value.replace(rxhtmlTag, "<$1></$2>");

								try {
									for (; i < l; i++) {
										elem = this[i] || {};
										if (elem.nodeType === 1) {
											$.cleanData(elem.getElementsByTagName("*"));
											elem.innerHTML = value;
										}
									}

									elem = 0;
								} catch (e) { }
							}

							if (elem) {
								element.empty().append(value);
							}
						}, null, value, arguments.length);
					}
					catch (error) {
						return $(element).html(value);
					}
				},

				hasTransform: function (el) {
					var transform = "";
					transform = el.css('transform');

					if (transform == "" || transform == 'none') {
						transform = el.parents().css('transform');
						if (transform == "" || transform == 'none') {
							var browserInfo = $.jqx.utilities.getBrowser();
							if (browserInfo.browser == 'msie') {
								transform = el.css('-ms-transform');
								if (transform == "" || transform == 'none') {
									transform = el.parents().css('-ms-transform');
								}
							}
							else if (browserInfo.browser == 'chrome') {
								transform = el.css('-webkit-transform');
								if (transform == "" || transform == 'none') {
									transform = el.parents().css('-webkit-transform');
								}
							}
							else if (browserInfo.browser == 'opera') {
								transform = el.css('-o-transform');
								if (transform == "" || transform == 'none') {
									transform = el.parents().css('-o-transform');
								}
							}
							else if (browserInfo.browser == 'mozilla') {
								transform = el.css('-moz-transform');
								if (transform == "" || transform == 'none') {
									transform = el.parents().css('-moz-transform');
								}
							}
						} else {
							return transform != "" && transform != 'none';
						}
					}
					if (transform == "" || transform == 'none') {
						transform = $(document.body).css('transform');
					}
					return transform != "" && transform != 'none' && transform != null;
				},

				getBrowser: function () {
					var ua = navigator.userAgent.toLowerCase();

					var match = /(chrome)[ \/]([\w.]+)/.exec(ua) ||
						/(webkit)[ \/]([\w.]+)/.exec(ua) ||
						/(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua) ||
						/(msie) ([\w.]+)/.exec(ua) ||
						ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua) ||
						[];

					var obj = {
						browser: match[1] || "",
						version: match[2] || "0"
					};
					if (ua.indexOf("rv:11.0") >= 0 && ua.indexOf(".net4.0c") >= 0) {
						obj.browser = "msie";
						obj.version = "11";
						match[1] = "msie";
					}
					if (ua.indexOf("edge") >= 0) {
						obj.browser = "msie";
						obj.version = "12";
						match[1] = "msie";
					}
					obj[match[1]] = match[1];
					return obj;
				}
			});
		$.jqx.browser = $.jqx.utilities.getBrowser();
		$.jqx.isHidden = function (element) {
			if (!element || !element[0])
				return false;

			var w = element[0].offsetWidth, h = element[0].offsetHeight;
			if (w === 0 || h === 0)
				return true;
			else {
				return false;
			}
		};

		$.jqx.ariaEnabled = true;
		$.jqx.aria = function (that, property, value) {
			if (!$.jqx.ariaEnabled)
				return;

			if (property == undefined) {
				$.each(that.aria, function (index, value) {
					var attrValue = !that.base ? that.host.attr(index) : that.base.host.attr(index);
					if (attrValue != undefined && !$.isFunction(attrValue)) {
						var newValue = attrValue;
						switch (value.type) {
							case "number":
								newValue = new Number(attrValue);
								if (isNaN(newValue)) newValue = attrValue;
								break;
							case "boolean":
								newValue = attrValue == "true" ? true : false;
								break;
							case "date":
								newValue = new Date(attrValue);
								if (newValue == "Invalid Date" || isNaN(newValue)) newValue = attrValue;
								break;
						}

						that[value.name] = newValue;
					}
					else {
						var attrValue = that[value.name];
						if ($.isFunction(attrValue)) attrValue = that[value.name]();
						if (attrValue == undefined) attrValue = "";
						try {
							!that.base ? that.host.attr(index, attrValue.toString()) : that.base.host.attr(index, attrValue.toString());
						}
						catch (error) {
						}
					}
				});
			}
			else {
				try {
					if (that.host) {
						if (!that.base) {
							if (that.host) {
								if (that.element.setAttribute) {
									that.element.setAttribute(property, value.toString());
								}
								else {
									that.host.attr(property, value.toString());
								}
							}
							else {
								that.attr(property, value.toString());
							}
						}
						else {
							if (that.base.host) {
								that.base.host.attr(property, value.toString());
							}
							else {
								that.attr(property, value.toString());
							}
						}
					}
					else if (that.setAttribute) {
						that.setAttribute(property, value.toString());
					}
				}
				catch (error) {
				}
			}
		};

		if (!Array.prototype.indexOf) {
			Array.prototype.indexOf = function (elt /*, from*/) {
				var len = this.length;

				var from = Number(arguments[1]) || 0;
				from = (from < 0)
					? Math.ceil(from)
					: Math.floor(from);
				if (from < 0)
					from += len;

				for (; from < len; from++) {
					if (from in this &&
						this[from] === elt)
						return from;
				}
				return -1;
			};
		}

		$.jqx.mobile = $.jqx.mobile || {};
		$.jqx.position = function (event) {
			var left = parseInt(event.pageX);
			var top = parseInt(event.pageY);

			if ($.jqx.mobile.isTouchDevice()) {
				var touches = $.jqx.mobile.getTouches(event);
				var touch = touches[0];
				left = parseInt(touch.pageX);
				top = parseInt(touch.pageY);
			}
			return { left: left, top: top }
		}

		$.extend($.jqx.mobile,
			{
				_touchListener: function (e, me) {
					var createTouchEvent = function (name, e) {
						var event = document.createEvent('MouseEvents');

						event.initMouseEvent(
							name,
							e.bubbles,
							e.cancelable,
							e.view,
							e.detail,
							e.screenX,
							e.screenY,
							e.clientX,
							e.clientY,
							e.ctrlKey,
							e.altKey,
							e.shiftKey,
							e.metaKey,
							e.button,
							e.relatedTarget
						);
						event._pageX = e.pageX;
						event._pageY = e.pageY;

						return event;
					}

					var eventMap = { 'mousedown': 'touchstart', 'mouseup': 'touchend', 'mousemove': 'touchmove' };
					var event = createTouchEvent(eventMap[e.type], e);
					e.target.dispatchEvent(event);

					var fn = e.target['on' + eventMap[e.type]];
					if (typeof fn === 'function') fn(e);
				},

				setMobileSimulator: function (element, value) {
					if (this.isTouchDevice()) {
						return;
					}

					this.simulatetouches = true;
					if (value == false) {
						this.simulatetouches = false;
					}

					var eventMap = { 'mousedown': 'touchstart', 'mouseup': 'touchend', 'mousemove': 'touchmove' };

					var self = this;
					if (window.addEventListener) {
						var subscribeToEvents = function () {
							for (var key in eventMap) {
								if (element.addEventListener) {
									element.removeEventListener(key, self._touchListener);
									element.addEventListener(key, self._touchListener, false);
								}

								//  document.removeEventListener(key, self._touchListener);
								//  document.addEventListener(key, self._touchListener, false);
							}
						}

						if ($.jqx.browser.msie) {
							subscribeToEvents();
						}
						else {
							subscribeToEvents();
						}
					}
				},

				isTouchDevice: function () {
					if (this.touchDevice != undefined)
						return this.touchDevice;

					var txt = "Browser CodeName: " + navigator.appCodeName + "";
					txt += "Browser Name: " + navigator.appName + "";
					txt += "Browser Version: " + navigator.appVersion + "";
					txt += "Platform: " + navigator.platform + "";
					txt += "User-agent header: " + navigator.userAgent + "";

					if (navigator.maxTouchPoints > 1) {
						//return true;
					}

					if (txt.indexOf('Android') != -1)
						return true;

					if (txt.indexOf('IEMobile') != -1)
						return true;

					if (txt.indexOf('Windows Phone') != -1)
						return true;

					if (txt.indexOf('WPDesktop') != -1)
						return true;

					if (txt.indexOf('ZuneWP7') != -1)
						return true;

					if (txt.indexOf('BlackBerry') != -1 && txt.indexOf('Mobile Safari') != -1)
						return true;

					if (txt.indexOf('ipod') != -1)
						return true;

					if (txt.indexOf('nokia') != -1 || txt.indexOf('Nokia') != -1)
						return true;

					if (txt.indexOf('Chrome/17') != -1)
						return false;

					if (txt.indexOf('CrOS') != -1)
						return false;

					if (txt.indexOf('Opera') != -1 && txt.indexOf('Mobi') == -1 && txt.indexOf('Mini') == -1 && txt.indexOf('Platform: Win') != -1) {
						return false;
					}

					if (txt.indexOf("HybridDeviceTouch") != -1) {
						return true
					}

					if (txt.indexOf("HybridDeviceMouse") != -1) {
						return false
					}

					if (txt.indexOf('Opera') != -1 && txt.indexOf('Mobi') != -1 && txt.indexOf('Opera Mobi') != -1) {
						return true;
					}

					if (txt.indexOf('Mozilla/5.0 (X11; Linux x86_64)') != -1) {
						return false;
					}

					var deviceTypes = {
						ios: 'i(?:Pad|Phone|Pod)(?:.*)CPU(?: iPhone)? OS ',
						android: '(Android |HTC_|Silk/)',
						blackberry: 'BlackBerry(?:.*)Version\/',
						rimTablet: 'RIM Tablet OS ',
						webos: '(?:webOS|hpwOS)\/',
						bada: 'Bada\/'
					}

					// check for IPad, IPhone, IE and Chrome
					try {
						if (this.touchDevice != undefined)
							return this.touchDevice;

						this.touchDevice = false;
						for (var i in deviceTypes) {
							if (deviceTypes.hasOwnProperty(i)) {
								var prefix = deviceTypes[i];
								var match = txt.match(new RegExp('(?:' + prefix + ')([^\\s;]+)'));
								if (match) {
									if (i.toString() == "blackberry") {
										// handle touches through mouse pointer.
										this.touchDevice = false;
										return false;
									}

									this.touchDevice = true;
									return true;
								}
							}
						}

						var userAgent = navigator.userAgent;
						if (navigator.platform.toLowerCase().indexOf('win') != -1) {
							if (userAgent.indexOf('Windows Phone') >= 0 || userAgent.indexOf('WPDesktop') >= 0 || userAgent.indexOf('IEMobile') >= 0 || userAgent.indexOf('ZuneWP7') >= 0) {
								this.touchDevice = true;
								return true;
							}
							else {
								if (userAgent.indexOf('Touch') >= 0) {
									var supported = ('MSPointerDown' in window) || ('pointerdown' in window);
									if (supported) {
										this.touchDevice = true;
										return true;
									}
									if (userAgent.indexOf('ARM') >= 0) {
										this.touchDevice = true;
										return true;
									}

									this.touchDevice = false;
									return false;
								}
							}
						}

						if (navigator.platform.toLowerCase().indexOf('win') != -1) {
							this.touchDevice = false;
							return false;
						}
						if (('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch) {
							this.touchDevice = true;
						}
						return this.touchDevice;
					} catch (e) {
						this.touchDevice = false;
						return false;
					}
				},

				getLeftPos: function (inputObj) {
					var returnValue = inputObj.offsetLeft;
					while ((inputObj = inputObj.offsetParent) != null) {
						if (inputObj.tagName != 'HTML') {
							returnValue += inputObj.offsetLeft;
							if (document.all) returnValue += inputObj.clientLeft;
						}
					}
					return returnValue;
				},

				getTopPos: function (inputObj) {
					var returnValue = inputObj.offsetTop;
					var initialOffset = $(inputObj).coord();
					while ((inputObj = inputObj.offsetParent) != null) {
						if (inputObj.tagName != 'HTML') {
							returnValue += (inputObj.offsetTop - inputObj.scrollTop);
							if (document.all) returnValue += inputObj.clientTop;
						}
					}
					var agent = navigator.userAgent.toLowerCase();
					var wp8 = (agent.indexOf('windows phone') != -1 || agent.indexOf('WPDesktop') != -1 || agent.indexOf('ZuneWP7') != -1 || agent.indexOf('msie 9') != -1 || agent.indexOf('msie 11') != -1 || agent.indexOf('msie 10') != -1) && agent.indexOf('touch') != -1;
					if (wp8) {
						return initialOffset.top;
					}

					if (this.isSafariMobileBrowser()) {
						if (this.isSafari4MobileBrowser() && this.isIPadSafariMobileBrowser()) {
							return returnValue;
						}
						if (agent.indexOf('version/7') != -1) {
							return initialOffset.top;
						}
						if (agent.indexOf('version/6') != -1 || agent.indexOf('version/5') != -1) {
							returnValue = returnValue + $(window).scrollTop();
						}
						if (/(Android.*Chrome\/[.0-9]* (!?Mobile))/.exec(navigator.userAgent)) {
							 return returnValue;
					//       return returnValue + $(window).scrollTop();
						}
						if (/(Android.*Chrome\/[.0-9]* Mobile)/.exec(navigator.userAgent)) {
							return returnValue;
					//        return returnValue + $(window).scrollTop();
						}

						return initialOffset.top;
					}

					return returnValue;
				},

				isChromeMobileBrowser: function () {
					var agent = navigator.userAgent.toLowerCase();
					var result = agent.indexOf('android') != -1;
					return result;
				},

				isOperaMiniMobileBrowser: function () {
					var agent = navigator.userAgent.toLowerCase();
					var result = agent.indexOf('opera mini') != -1 || agent.indexOf('opera mobi') != -1;
					return result;
				},

				isOperaMiniBrowser: function () {
					var agent = navigator.userAgent.toLowerCase();
					var result = agent.indexOf('opera mini') != -1;
					return result;
				},

				isNewSafariMobileBrowser: function () {
					var agent = navigator.userAgent.toLowerCase();
					var result = agent.indexOf('ipad') != -1 || agent.indexOf('iphone') != -1 || agent.indexOf('ipod') != -1;
					result = result && (agent.indexOf('version/5') != -1);
					return result;
				},

				isSafari4MobileBrowser: function () {
					var agent = navigator.userAgent.toLowerCase();
					var result = agent.indexOf('ipad') != -1 || agent.indexOf('iphone') != -1 || agent.indexOf('ipod') != -1;
					result = result && (agent.indexOf('version/4') != -1);
					return result;
				},

				isWindowsPhone: function () {
					var agent = navigator.userAgent.toLowerCase();
					var result = (agent.indexOf('windows phone') != -1 || agent.indexOf('WPDesktop') != -1 || agent.indexOf('ZuneWP7') != -1 || agent.indexOf('msie 9') != -1 || agent.indexOf('msie 11') != -1 || agent.indexOf('msie 10') != -1 && agent.indexOf('touch') != -1);
					return result;
				},

				isSafariMobileBrowser: function () {
					var agent = navigator.userAgent.toLowerCase();
					if (/(Android.*Chrome\/[.0-9]* (!?Mobile))/.exec(navigator.userAgent)) {
						return true;
					}
					if (/(Android.*Chrome\/[.0-9]* Mobile)/.exec(navigator.userAgent)) {
						return true;
					}

					var result = agent.indexOf('ipad') != -1 || agent.indexOf('iphone') != -1 || agent.indexOf('ipod') != -1 || agent.indexOf('mobile safari') != -1;
					return result;
				},

				isIPadSafariMobileBrowser: function () {
					var agent = navigator.userAgent.toLowerCase();
					var result = agent.indexOf('ipad') != -1;
					return result;
				},

				isMobileBrowser: function () {
					var agent = navigator.userAgent.toLowerCase();
					var result = agent.indexOf('ipad') != -1 || agent.indexOf('iphone') != -1 || agent.indexOf('android') != -1;
					return result;
				},

				// Get the touch points from this event
				getTouches: function (e) {
					if (e.originalEvent) {
						if (e.originalEvent.touches && e.originalEvent.touches.length) {
							return e.originalEvent.touches;
						} else if (e.originalEvent.changedTouches && e.originalEvent.changedTouches.length) {
							return e.originalEvent.changedTouches;
						}
					}

					if (!e.touches) {
						e.touches = new Array();
						e.touches[0] = e.originalEvent != undefined ? e.originalEvent : e;

						if (e.originalEvent != undefined && e.pageX)
							e.touches[0] = e;
						if (e.type == 'mousemove') e.touches[0] = e;
					}

					return e.touches;
				},

				getTouchEventName: function (name) {
					if (this.isWindowsPhone()) {

						var agent = navigator.userAgent.toLowerCase();
						if (agent.indexOf('windows phone 7') != -1) {
							if (name.toLowerCase().indexOf('start') != -1) return 'MSPointerDown';
							if (name.toLowerCase().indexOf('move') != -1) return 'MSPointerMove';
							if (name.toLowerCase().indexOf('end') != -1) return 'MSPointerUp';
						}
						if (name.toLowerCase().indexOf('start') != -1) return 'pointerdown';
						if (name.toLowerCase().indexOf('move') != -1) return 'pointermove';
						if (name.toLowerCase().indexOf('end') != -1) return 'pointerup';
					}
					else {
						return name;
					}
				},

				// Dispatches a fake mouse event from a touch event
				dispatchMouseEvent: function (name, touch, target) {
					if (this.simulatetouches)
						return;

					var e = document.createEvent('MouseEvent');
					e.initMouseEvent(name, true, true, touch.view, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
					if (target != null) {
						target.dispatchEvent(e);
					}
				},

				// Find the root node of this target
				getRootNode: function (target) {
					while (target.nodeType !== 1) {
						target = target.parentNode;
					}
					return target;
				},

				setTouchScroll: function (enable, key) {
					if (!this.enableScrolling) this.enableScrolling = [];
					this.enableScrolling[key] = enable;
				},

				touchScroll: function (element, scrollHeight, callback, key, horizontalScroll, verticalScroll) {
					if (element == null)
						return;

					var me = this;
					var scrollY = 0;
					var touchY = 0;
					var movedY = 0;
					var scrollX = 0;
					var touchX = 0;
					var movedX = 0;
					if (!this.scrolling) this.scrolling = [];
					this.scrolling[key] = false;
					var moved = false;
					var $element = $(element);
					var touchTags = ['select', 'input', 'textarea'];
					var touchStart = 0;
					var touchEnd = 0;
					if (!this.enableScrolling) this.enableScrolling = [];
					this.enableScrolling[key] = true;
					var key = key;
					var touchStartName = this.getTouchEventName('touchstart') + ".touchScroll";
					var touchEndName = this.getTouchEventName('touchend') + ".touchScroll";
					var touchMoveName = this.getTouchEventName('touchmove') + ".touchScroll";

					//            horizontalScroll.fadeOut(0);
					//            verticalScroll.fadeOut(0);

					var view, indicator, relative, xframe, xdelta,
						xmax, min, max, offset, reference, pressed, xform,
						jqxAnimations, xjqxAnimations, frame, timestamp, ticker,
						amplitude, target, xtarget, xreference, timeConstant;
					max = scrollHeight;
					var min = 0;
					var offset = 0;
					var xoffset = 0;
					var initialOffset = 0;
					var initialXOffset = 0;
					var xmax = horizontalScroll.jqxScrollBar('max');
					var timeConstant = 325; // ms

					function ypos(e) {
						// touch event
						if (e.targetTouches && (e.targetTouches.length >= 1)) {
							return e.targetTouches[0].clientY;
						}
						else if (e.originalEvent && e.originalEvent.clientY !== undefined) {
							return e.originalEvent.clientY;
						}
						else {
							var touches = me.getTouches(e);
							return touches[0].clientY;
						}

						// mouse event
						//    return e.clientY;
					}

					function xpos(e) {
						// touch event
						if (e.targetTouches && (e.targetTouches.length >= 1)) {
							return e.targetTouches[0].clientX;
						}
						else if (e.originalEvent && e.originalEvent.clientX !== undefined) {
							return e.originalEvent.clientX;
						}
						else {
							var touches = me.getTouches(e);
							return touches[0].clientX;
						}

						// mouse event
						//   return e.clientX;
					}

					var track = function () {
						var now, elapsed, delta, v;

						now = Date.now();
						elapsed = now - timestamp;
						timestamp = now;
						delta = offset - frame;
						var xdelta = xoffset - xframe;
						frame = offset;
						xframe = xoffset;
						pressed = true;
						v = 1000 * delta / (1 + elapsed);
						var xv = 1000 * xdelta / (1 + elapsed);
						jqxAnimations = 0.8 * v + 0.2 * jqxAnimations;
						xjqxAnimations = 0.8 * xv + 0.2 * xjqxAnimations;
					}

					var tapped = false;

					var touchStart = function (event) {
						if (!me.enableScrolling[key])
							return true;

						// Allow certain HTML tags to receive touch events
						if ($.inArray(event.target.tagName.toLowerCase(), touchTags) !== -1) {
							return;
						}
						offset = verticalScroll.jqxScrollBar('value');
						xoffset = horizontalScroll.jqxScrollBar('value');

						var touches = me.getTouches(event);
						var touch = touches[0];
						if (touches.length == 1) {
							me.dispatchMouseEvent('mousedown', touch, me.getRootNode(touch.target));
						}
						xmax = horizontalScroll.jqxScrollBar('max');
						max = verticalScroll.jqxScrollBar('max');
						function tap(e) {
							tapped = false;
							pressed = true;
							reference = ypos(e);
							xreference = xpos(e);
							jqxAnimations = amplitude = xjqxAnimations = 0;
							frame = offset;
							xframe = xoffset;
							timestamp = Date.now();
							clearInterval(ticker);
							ticker = setInterval(track, 100);
							initialOffset = offset;
							initialXOffset = xoffset;

							if (offset > 0 && offset < max && verticalScroll[0].style.visibility != "hidden") {
								//      e.preventDefault();
							}
							//    if (xoffset > 0 && xoffset < xmax && horizontalScroll[0].style.visibility != "hidden") {
							//        e.preventDefault();

							//      e.stopPropagation();
							//   e.stopPropagation();
							// return false;
						}

						tap(event);
						moved = false;
						touchY = touch.pageY;
						touchX = touch.pageX;
						if (me.simulatetouches) {
							if (touch._pageY != undefined) {
								touchY = touch._pageY;
								touchX = touch._pageX;
							}
						}
						me.scrolling[key] = true;
						scrollY = 0;
						scrollX = 0;
						return true;
					}

					if ($element.on) {
						$element.on(touchStartName, touchStart);
					}
					else {
						$element.bind(touchStartName, touchStart);
					}

					var scroll = function (top, event) {
						offset = (top > max) ? max : (top < min) ? min : top;
						callback(null, top, 0, 0, event);

						return (top > max) ? "max" : (top < min) ? "min" : "value";
					}

					var hscroll = function (left, event) {
						xoffset = (left > xmax) ? xmax : (left < min) ? min : left;
						callback(left, null, 0, 0, event);

						return (left > xmax) ? "max" : (left < min) ? "min" : "value";
					}

					function autoScroll() {
						var elapsed, delta;
						if (amplitude) {
							elapsed = Date.now() - timestamp;
							delta = -amplitude * Math.exp(-elapsed / timeConstant);
							if (delta > 0.5 || delta < -0.5) {
								scroll(target + delta);
								requestAnimationFrame(autoScroll);
							} else {
								scroll(target);
								//     verticalScroll.fadeOut('fast');
							}
						}
					}
					function hAutoScroll() {
						var elapsed, delta;
						if (amplitude) {
							elapsed = Date.now() - timestamp;
							delta = -amplitude * Math.exp(-elapsed / timeConstant);
							if (delta > 0.5 || delta < -0.5) {
								hscroll(xtarget + delta);
								requestAnimationFrame(hAutoScroll);
							} else {
								hscroll(xtarget);
								//        horizontalScroll.fadeOut('fast');
							}

						}
					}
					var touchMove = function (event) {
						if (!me.enableScrolling[key])
							return true;

						if (!me.scrolling[key]) {
							return true;
						}

						if (tapped) {
							event.preventDefault();
							event.stopPropagation();
						}

						var touches = me.getTouches(event);
						if (touches.length > 1) {
							return true;
						}

						var pageY = touches[0].pageY;
						var pageX = touches[0].pageX;

						if (me.simulatetouches) {
							if (touches[0]._pageY != undefined) {
								pageY = touches[0]._pageY;
								pageX = touches[0]._pageX;
							}
						}


						var dy = pageY - touchY;
						var dx = pageX - touchX;
						touchEnd = pageY;
						var touchHorizontalEnd = pageX;
						movedY = dy - scrollY;
						movedX = dx - scrollX;
						moved = true;
						scrollY = dy;
						scrollX = dx;

						var hScrollVisible = horizontalScroll != null ? horizontalScroll[0].style.visibility != 'hidden' : true;
						var vScrollVisible = verticalScroll != null ? verticalScroll[0].style.visibility != 'hidden' : true;


						function drag(e) {
							var y, delta, x;
							if (pressed) {
								y = ypos(e);
								x = xpos(e);
								delta = reference - y;
								xdelta = xreference - x;
								var dragged = "value";
								if (delta > 2 || delta < -2) {
									reference = y;
									dragged = scroll(offset + delta, e);
									track();

									if (dragged == "min" && initialOffset === 0) {
										return true;
									}
									if (dragged == "max" && initialOffset === max) {
										return true;
									}

									if (!vScrollVisible) {
										return true;
									}
									e.preventDefault();
									e.stopPropagation();
									tapped = true;

									return false;
								}
								else {
									if (xdelta > 2 || xdelta < -2) {
										xreference = x;
										dragged = hscroll(xoffset + xdelta, e);
										track();

										if (dragged == "min" && initialXOffset === 0) {
											return true;
										}
										if (dragged == "max" && initialXOffset === xmax) {
											return true;
										}

										if (!hScrollVisible) {
											return true;
										}
										tapped = true;
										e.preventDefault();
										e.stopPropagation();
										return false;
									}
								}
								e.preventDefault();
							}
						}

						if (hScrollVisible || vScrollVisible) {
							if ((hScrollVisible) || (vScrollVisible)) {
								drag(event);

								//      callback(-movedX * 1, -movedY * 1, dx, dy, event);
								//event.preventDefault();
								//event.stopPropagation();
								//if (event.preventManipulation) {
								//    event.preventManipulation();
								//}
								//return false;
							}
						}
					}

					if ($element.on) {
						$element.on(touchMoveName, touchMove);
					}
					else $element.bind(touchMoveName, touchMove);



					var touchCancel = function (event) {
						if (!me.enableScrolling[key])
							return true;

						var touch = me.getTouches(event)[0];
						if (!me.scrolling[key]) {
							return true;
						}

						pressed = false;
						clearInterval(ticker);
						if (jqxAnimations > 10 || jqxAnimations < -10) {
							amplitude = 0.8 * jqxAnimations;
							target = Math.round(offset + amplitude);
							timestamp = Date.now();
							requestAnimationFrame(autoScroll);
							//             verticalScroll.fadeIn(100);
						}
						else if (xjqxAnimations > 10 || xjqxAnimations < -10) {
							amplitude = 0.8 * xjqxAnimations;
							xtarget = Math.round(xoffset + amplitude);
							timestamp = Date.now();
							requestAnimationFrame(hAutoScroll);
							//          horizontalScroll.fadeIn(100);
						}
						else {
							//        horizontalScroll.fadeOut(100);
							//        verticalScroll.fadeOut(100);
						}

						me.scrolling[key] = false;
						if (moved) {
							me.dispatchMouseEvent('mouseup', touch, event.target);
						} else {
							var touch = me.getTouches(event)[0],
								t = me.getRootNode(touch.target);

							//        event.preventDefault();
							//         event.stopPropagation();
							// Dispatch fake mouse up and click events if this touch event did not move
							me.dispatchMouseEvent('mouseup', touch, t);
							me.dispatchMouseEvent('click', touch, t);
							return true;
						}
					}

					if (this.simulatetouches) {
						var windowBindFunc = $(window).on != undefined || $(window).bind;
						var windowMouseUp = function (event) {
							try {
								touchCancel(event);
							}
							catch (er) {
							}
							me.scrolling[key] = false;
						};
						$(window).on != undefined ? $(document).on('mouseup.touchScroll', windowMouseUp) : $(document).bind('mouseup.touchScroll', windowMouseUp);

						if (window.frameElement) {
							if (window.top != null) {
								var eventHandle = function (event) {
									try {
										touchCancel(event);
									}
									catch (er) {
									}
									me.scrolling[key] = false;
								};

								if (window.top.document) {
									$(window.top.document).on ? $(window.top.document).on('mouseup', eventHandle) : $(window.top.document).bind('mouseup', eventHandle);
								}
							}
						}

						var docBindFunc = $(document).on != undefined || $(document).bind;
						var touchEndFunc = function (event) {
							if (!me.scrolling[key]) {
								return true;
							}

							me.scrolling[key] = false;
							var touch = me.getTouches(event)[0],
								target = me.getRootNode(touch.target);

							// Dispatch fake mouse up and click events if this touch event did not move
							me.dispatchMouseEvent('mouseup', touch, target);
							me.dispatchMouseEvent('click', touch, target);
						};

						$(document).on != undefined ? $(document).on('touchend', touchEndFunc) : $(document).bind('touchend', touchEndFunc);
					}

					if ($element.on) {
						$element.on('dragstart', function (event) {
							event.preventDefault();
						});
						$element.on('selectstart', function (event) {
							event.preventDefault();
						});
					}
					$element.on ? $element.on(touchEndName + ' touchcancel.touchScroll', touchCancel) : $element.bind(touchEndName + ' touchcancel.touchScroll', touchCancel);
				}

			});

		$.jqx.cookie = $.jqx.cookie || {};
		$.extend($.jqx.cookie,
			{
				cookie: function (key, value, options) {
					// set cookie.
					if (arguments.length > 1 && String(value) !== "[object Object]") {
						options = $.extend({}, options);

						if (value === null || value === undefined) {
							options.expires = -1;
						}

						if (typeof options.expires === 'number') {
							var days = options.expires, t = options.expires = new Date();
							t.setDate(t.getDate() + days);
						}

						value = String(value);

						return (document.cookie = [
							encodeURIComponent(key), '=',
							options.raw ? value : encodeURIComponent(value),
							options.expires ? '; expires=' + options.expires.toUTCString() : '', // use expires attribute, max-age is not supported by IE
							options.path ? '; path=' + options.path : '',
							options.domain ? '; domain=' + options.domain : '',
							options.secure ? '; secure' : ''
						].join(''));
					}
					// get cookie...
					options = value || {};
					var result, decode = options.raw ? function (s) { return s; } : decodeURIComponent;
					return (result = new RegExp('(?:^|; )' + encodeURIComponent(key) + '=([^;]*)').exec(document.cookie)) ? decode(result[1]) : null;
				}
			});

		// stringutilities
		$.jqx.string = $.jqx.string || {};
		$.extend($.jqx.string,
			{
				replace: function (text, stringToFind, stringToReplace) {
					if (stringToFind === stringToReplace) return this;
					var temp = text;
					var index = temp.indexOf(stringToFind);
					while (index != -1) {
						temp = temp.replace(stringToFind, stringToReplace);
						index = temp.indexOf(stringToFind);
					}
					return temp;
				},

				contains: function (fullString, value) {
					if (fullString == null || value == null)
						return false;

					return fullString.indexOf(value) != -1;
				},

				containsIgnoreCase: function (fullString, value) {
					if (fullString == null || value == null)
						return false;

					return fullString.toString().toUpperCase().indexOf(value.toString().toUpperCase()) != -1;
				},

				equals: function (fullString, value) {
					if (fullString == null || value == null)
						return false;

					fullString = this.normalize(fullString);

					if (value.length == fullString.length) {
						return fullString.slice(0, value.length) == value;
					}

					return false;
				},

				equalsIgnoreCase: function (fullString, value) {
					if (fullString == null || value == null)
						return false;

					fullString = this.normalize(fullString);

					if (value.length == fullString.length) {
						return fullString.toUpperCase().slice(0, value.length) == value.toUpperCase();
					}

					return false;
				},

				startsWith: function (fullString, value) {
					if (fullString == null || value == null)
						return false;

					return fullString.slice(0, value.length) == value;
				},

				startsWithIgnoreCase: function (fullString, value) {
					if (fullString == null || value == null)
						return false;

					return fullString.toUpperCase().slice(0, value.length) == value.toUpperCase();
				},

				normalize: function (fullString) {
					if (fullString.charCodeAt(fullString.length - 1) == 65279) {
						fullString = fullString.substring(0, fullString.length - 1);
					}

					return fullString;
				},

				endsWith: function (fullString, value) {
					if (fullString == null || value == null)
						return false;

					fullString = this.normalize(fullString);
					return fullString.slice(-value.length) == value;
				},

				endsWithIgnoreCase: function (fullString, value) {
					if (fullString == null || value == null)
						return false;

					fullString = this.normalize(fullString);

					return fullString.toUpperCase().slice(-value.length) == value.toUpperCase();
				}
			});

		$.extend($.easing, {
			easeOutBack: function (x, t, b, c, d, s) {
				if (s == undefined) s = 1.70158;
				return c * ((t = t / d - 1) * t * ((s + 1) * t + s) + 1) + b;
			},
			easeInQuad: function (x, t, b, c, d) {
				return c * (t /= d) * t + b;
			},
			easeInOutCirc: function (x, t, b, c, d) {
				if ((t /= d / 2) < 1) return -c / 2 * (Math.sqrt(1 - t * t) - 1) + b;
				return c / 2 * (Math.sqrt(1 - (t -= 2) * t) + 1) + b;
			},
			easeInOutSine: function (x, t, b, c, d) {
				return -c / 2 * (Math.cos(Math.PI * t / d) - 1) + b;
			},
			easeInCubic: function (x, t, b, c, d) {
				return c * (t /= d) * t * t + b;
			},
			easeOutCubic: function (x, t, b, c, d) {
				return c * ((t = t / d - 1) * t * t + 1) + b;
			},
			easeInOutCubic: function (x, t, b, c, d) {
				if ((t /= d / 2) < 1) return c / 2 * t * t * t + b;
				return c / 2 * ((t -= 2) * t * t + 2) + b;
			},
			easeInSine: function (x, t, b, c, d) {
				return -c * Math.cos(t / d * (Math.PI / 2)) + c + b;
			},
			easeOutSine: function (x, t, b, c, d) {
				return c * Math.sin(t / d * (Math.PI / 2)) + b;
			},
			easeInOutSine: function (x, t, b, c, d) {
				return -c / 2 * (Math.cos(Math.PI * t / d) - 1) + b;
			}
		});
	})(jqxBaseFramework);

	(function ($) {
		if ($.event && $.event.special) {
			$.extend($.event.special,
				{
					"close": { noBubble: true },
					"open": { noBubble: true },
					"cellclick": { noBubble: true },
					"rowclick": { noBubble: true },
					"tabclick": { noBubble: true },
					"selected": { noBubble: true },
					"expanded": { noBubble: true },
					"collapsed": { noBubble: true },
					"valuechanged": { noBubble: true },
					"expandedItem": { noBubble: true },
					"collapsedItem": { noBubble: true },
					"expandingItem": { noBubble: true },
					"collapsingItem": { noBubble: true }
				});
		}
		if ($.fn.extend) {
			$.fn.extend({
				ischildof: function (filter_string) {
					if (!$(this).parents) {
						var result = filter_string.element.contains(this.element)
						return result;
					}

					var parents = $(this).parents().get();

					for (var j = 0; j < parents.length; j++) {
						if (typeof filter_string != "string") {
							var parent = parents[j];
							if (filter_string !== undefined) {
								if (parent == filter_string[0])
									return true;
							}
						}
						else {
							if (filter_string !== undefined) {
								if ($(parents[j]).is(filter_string)) {
									return true;
								}
							}
						}
					}

					return false;
				}
			});
		}

		$.fn.jqxProxy = function () {
			var widget = $(this).data().jqxWidget;
			var args = Array.prototype.slice.call(arguments, 0);
			var element = widget.element;
			if (!element) element = widget.base.element;
			return $.jqx.jqxWidgetProxy(widget.widgetName, element, args);
		}

		var originalVal = $.originalVal = $.fn.val;
		$.fn.val = function (value) {
			if (typeof value == 'undefined') {
				if ($(this).hasClass('jqx-widget') || $(this).hasClass('jqx-input-group')) {
					var widget = $(this).data().jqxWidget;
					if (widget && widget.val) {
						return widget.val();
					}
				}
				if (this[0] && this[0].tagName.toLowerCase().indexOf('angular') >= 0) {
					var widget = $(this).find('.jqx-widget').data().jqxWidget;
					if (widget && widget.val) {
						return widget.val();
					}

				}
				return originalVal.call(this);
			}
			else {
				if ($(this).hasClass('jqx-widget') || $(this).hasClass('jqx-input-group')) {
					var widget = $(this).data().jqxWidget;
					if (widget && widget.val) {
						if (arguments.length != 2) {
							return widget.val(value);
						}
						else {
							return widget.val(value, arguments[1]);
						}
					}
				}
				if (this[0] && this[0].tagName.toLowerCase().indexOf('angular') >= 0) {
					var widget = $(this).find('.jqx-widget').data().jqxWidget;
					if (widget && widget.val) {
						if (arguments.length != 2) {
							return widget.val(value);
						}
						else {
							return widget.val(value, arguments[1]);
						}
					}

				}

				return originalVal.call(this, value);
			}
		};

		if ($.fn.modal && $.fn.modal.Constructor) {
			$.fn.modal.Constructor.prototype.enforceFocus = function () {
				$(document)
					.off('focusin.bs.modal') // guard against infinite focus loop
					.on('focusin.bs.modal', $.proxy(function (e) {
						if (this.$element[0] !== e.target && !this.$element.has(e.target).length) {
							if ($(e.target).parents().hasClass('jqx-popup'))
								return true;
							this.$element.trigger('focus')
						}
					}, this));
			}
		}

		$.fn.coord = function (options) {
			var docElem, win,
				box = { top: 0, left: 0 },
				elem = this[0],
				doc = elem && elem.ownerDocument;
			if (!doc) {
				return;
			}
			docElem = doc.documentElement;
			if (!$.contains(docElem, elem)) {
				return box;
			}
			if (typeof elem.getBoundingClientRect !== undefined) {
				box = elem.getBoundingClientRect();
			}
			var getWindow = function (elem) {
				return $.isWindow(elem) ?
					elem :
					elem.nodeType === 9 ?
						elem.defaultView || elem.parentWindow :
						false;
			};

			win = getWindow(doc);
			var additionalLeftOffset = 0;
			var additionalTopOffset = 0;
			var agent = navigator.userAgent.toLowerCase();
			var result = agent.indexOf('ipad') != -1 || agent.indexOf('iphone') != -1;
			if (result) {
				// fix for iphone/ipad left offsets.
				additionalLeftOffset = 2;
			}
			if (true == options) {
				if (document.body.style.position != 'static' && document.body.style.position != '') {
					var coords = $(document.body).coord();
					additionalLeftOffset = -coords.left;
					additionalTopOffset = -coords.top;
				}
			}

			return {
				top: additionalTopOffset + box.top + (win.pageYOffset || docElem.scrollTop) - (docElem.clientTop || 0),
				left: additionalLeftOffset + box.left + (win.pageXOffset || docElem.scrollLeft) - (docElem.clientLeft || 0)
			};
		};

		$.jqx.ripplers = [];
		$.jqx.ripple = function (element, hostElement, hostElementType) {
			if (!hostElement) {
				hostElement = element;
			}

			var rippler = $(element);
			var mouseCaptured = false;

			rippler.append("<span class='ink'></span>");
			var ink = rippler.find('.ink');


			var hasRippler = false;

			for (var i = 0; i < $.jqx.ripplers.length; i++) {
				var ripplerItem = $.jqx.ripplers[i];

				if (ripplerItem.element[0] === element[0]) {
					hasRippler = true;
					break;
				}
			}

			if (!hasRippler) {
				$.jqx.ripplers.push({ ink: ink, element: element, hostElement: hostElement, hostElementType: hostElementType });
			}

			if (hostElementType === "checkbox" || hostElementType === "radiobutton") {

				// set .ink diametr
				var d = Math.max(rippler.outerWidth(), rippler.outerHeight());
				ink.css({ height: d, width: d });

				var x = rippler.width() / 2 - ink.width() / 2;
				var y = rippler.height() / 2 - ink.height() / 2;

				// set .ink position and add class .animate
				ink.css({
					top: y + 'px',
					left: x + 'px'
				});
			}

			// Ripple-effect animation
			if ($.jqx.ripplers.length === 1) {
				$(document).on('mouseup', function (e) {
					$.jqx.ripple.mouseCaptured = false;

					for (var i = 0; i < $.jqx.ripplers.length; i++) {
						var rippler = $.jqx.ripplers[i];

						rippler.ink.removeClass('active');
						rippler.element.removeClass('active');

						if (hostElementType !== "checkbox" && hostElementType !== "radiobutton") {
							if (rippler.ink.hasClass('animate')) {
								rippler.ink.removeClass('animate');
							}
						}
					}
				});
			}
			hostElement.off('mousedown.ripple');
			hostElement.on('mousedown.ripple', function (e) {
				var rippler = $(element);

				$.jqx.ripple.mouseCaptured = true;

				setTimeout(function () {
					// create .ink element if it doesn't exist

					if (rippler.find('.ink').length == 0) {
						rippler.append("<span class='ink'></span>");
					}

					var ink = rippler.find('.ink');

					// prevent quick double clicks
					ink.removeClass('animate');


					// set .ink diametr
					if (!ink.height() && !ink.width()) {
						var d = Math.max(rippler.outerWidth(), rippler.outerHeight());
						ink.css({ height: d, width: d });
					}

					if (hostElementType === "checkbox" || hostElementType === "radiobutton") {
						if (hostElementType === "checkbox") {
							if (hostElement.jqxCheckBox('disabled')) {
								return;
							}
						}

						if (hostElementType === "radiobutton") {
							if (hostElement.jqxRadioButton('disabled')) {
								return;
							}
						}

						// get click coordinates
						var x = rippler.width() / 2 - ink.width() / 2;
						var y = rippler.height() / 2 - ink.height() / 2;

						// set .ink position and add class .animate
						ink.css({
							top: y + 'px',
							left: x + 'px'
						}).addClass('animate');

						ink.on('animationend', function () {
							if ($.jqx.ripple.mouseCaptured) {
								ink.removeClass('animate')
								ink.addClass('active')
								element.addClass('active')
							}
						});

						return;
					}

					// get click coordinates
					var x = e.pageX - rippler.offset().left - ink.width() / 2;
					var y = e.pageY - rippler.offset().top - ink.height() / 2;

					// set .ink position and add class .animate
					ink.css({
						top: y + 'px',
						left: x + 'px'
					}).addClass('animate');
				});
			});
		}
	})(jqxBaseFramework);
})();




/***/ }),

/***/ 1610:
/***/ (() => {

﻿/* tslint:disable */
/* eslint-disable */
(function(){
	if (typeof document === 'undefined') { 
		return;
	}

(function ($) {

    $.jqx.jqxWidget("jqxMenu", "", {});

    $.extend($.jqx._jqxMenu.prototype, {
        defineInstance: function () {
            var settings = {
                //Type: Array
                //Gets the menu's items.
                items: new Array(),
                //Type: String.
                //Default: 'horizontal'.
                //Gets or sets the menu's display mode.
                //Possible Values: 'horizontal', 'vertical', 'popup', 'simple'
                mode: 'horizontal',
                //Type: Number.
                //Default: null.
                //Sets the width.
                width: null,
                //Type: Number.
                //Default: null.
                //Sets the height.
                height: null,
                //Type: Number.
                //Default: 'auto'.
                //Sets the height.
                minimizeWidth: 'auto',
                //Type: String.
                //Default: easeInOutSine.
                //Gets or sets the animation's easing to one of the JQuery's supported easings.
                easing: 'easeInOutSine',
                //Type: Number.
                //Default: 500.
                //Gets or sets the duration of the show animation.
                animationShowDuration: 200,
                //Type: Number.
                //Default: 'fast'.
                //Gets or sets the duration of the hide animation.
                animationHideDuration: 200,
                // Type: Number
                // Default: 0
                // Gets or sets whether the menu is automatically closed after a period of time.
                autoCloseInterval: 0,
                //Type: Number.
                //Default: 500.
                //Gets or sets the delay before the start of the hide animation.
                animationHideDelay: 100,
                //Type: Number.
                //Default: 200.
                //Gets or sets the delay before the start of the show animation.
                animationShowDelay: 10,
                //Type: Array.
                menuElements: new Array(),
                //Type: Boolean.
                //Default: true.
                //Auto-Sizes the Menu's main items when the menu's mode is 'horizontal'.
                autoSizeMainItems: false,
                //Type: Boolean.
                //Default: true.
                //Automatically closes the opened popups after a click.
                autoCloseOnClick: true,
                //Type: Boolean.
                //Default: true.
                //Automatically closes the opened popups after mouse leave.
                autoCloseOnMouseLeave: true,
                //Type: Boolean.
                //Default: true.
                //Enables or disables the rounded corners.
                enableRoundedCorners: true,
                //Type: Boolean.
                //Default: true.
                //Enables or disables the Menu.
                disabled: false,
                //Type: Boolean.
                //Default: true.
                //Opens the Context Menu when the right-mouse button is pressed.
                //When this property is set to false, the Open and Close functions can be used to open and close
                //the Context Menu.
                autoOpenPopup: true,
                // Type: Boolean
                // Default: true
                // enables or disables the hover state.
                enableHover: true,
                // Type: Boolean
                // Default: true
                // opens the top level menu items when the user hovers them.
                autoOpen: true,
                // Type: Boolean
                // Default: false
                // When this property is true, the menu is auto generated using all of ul and li tags inside the host.
                autoGenerate: true,
                // Type: Boolean
                // Default: false
                // opens an item after a click by the user.
                clickToOpen: false,
                // Type: Boolean
                // Default: false
                // shows the top-level item arrows in the default horizontal menu mode.
                showTopLevelArrows: false,
                // Sets whether the menu is on touch device.
                touchMode: 'auto',
                // Sets menu's source.
                source: null,
                popupZIndex: 1000,
                rtl: false,
                keyboardNavigation: false,
                lockFocus: false,
                title: "",
                // Menu events.
                events:
                    [
                        'shown', 'closed', 'itemclick', 'initialized', 'open', 'close'
                    ]
            };
            if (this === $.jqx._jqxMenu.prototype) {
                return settings;
            }
            $.extend(true, this, settings);
            return settings;
        },

        createInstance: function (args) {
            var self = this;
            this.host.attr('role', 'menubar');
            $.jqx.utilities.resize(this.host, function () {
                self.refresh();
            }, false, this.mode != "popup");
            if (this.minimizeWidth != "auto" && this.minimizeWidth != null && this.width && this.width.toString().indexOf('%') == -1) {
                $(window).resize(function () {
                    self.refresh();
                });
            }

            if (self.isMaterialized()) {
                var elementStyle = window.getComputedStyle(this.element);
                var animation = elementStyle.getPropertyValue('--jqx-dropdown-animation');

                if (animation) {
                    this.animationType = animation.trim();
                    if (this.animationType === "transform") {
                        this.animationShowDuration = 0;
                        this.animationHideDuration = 0;
                        this.animationShowDelay = 0;
                    }
                }
            }

            this.host.css('outline', 'none');

            if (this.source) {
                if (this.source != null) {
                    var html = this.loadItems(this.source);
                    this.element.innerHTML = html;
                }
            }

            this._tmpHTML = this.element.innerHTML;
            if (this.element.innerHTML.indexOf('UL')) {
                var innerElement = this.host.find('ul:first');
                if (innerElement.length > 0) {
                    this._createMenu(innerElement[0]);
                }
            }

            this.host.data('autoclose', {});

            this._render();
            this._setSize();
            if ($.jqx.browser.msie && $.jqx.browser.version < 8) {
                this.host.attr('hideFocus', true);
            }
        },

        focus: function () {
            try {
                if (this.mode === "popup" && this.keyboardNavigation) {
                    var $popupElementparent = this.host.closest('div.jqx-menu-wrapper');
                    $popupElementparent.focus();
                }
                if (this.keyboardNavigation) {
                    this.host.focus();
                    var that = this;
                    var setActiveItem = function () {
                        if (!$.jqx.isHidden($(that.items[0].element))) {
                            $(that.items[0].element).addClass(that.toThemeProperty('jqx-fill-state-focus'));
                            that.activeItem = that.items[0];
                        }
                        else {
                            var item = that._nextVisibleItem(that.items[0], 0);
                            if (item) {
                                $(item.element).addClass(that.toThemeProperty('jqx-fill-state-focus'));
                                that.activeItem = item;
                            }
                        }
                    }

                    if (!this.activeItem) {
                        setActiveItem();
                    }
                    else {
                        if (!$.jqx.isHidden($(this.activeItem.element))) {
                            $(this.activeItem.element).addClass(this.toThemeProperty('jqx-fill-state-focus'));
                        }
                        else {
                            $(this.activeItem.element).removeClass(this.toThemeProperty('jqx-fill-state-focus'));
                            setActiveItem();
                        }
                    }
                }
            }
            catch (error) {
            }
        },

        loadItems: function (items, subMenuWidth) {
            if (items == null) {
                return;
            }
            if (items.length == 0) return "";

            var self = this;
            this.items = new Array();
            var html = '<ul class="jqx-menu-ul">';
            if (subMenuWidth) {
                html = '<ul class="jqx-menu-ul" style="width:' + subMenuWidth + ';">';
            }

            $.map(items, function (item) {
                if (item == undefined)
                    return null;

                html += self._parseItem(item);
            });

            html += '</ul>';
            return html;
        },

        _parseItem: function (item) {
            var html = "";

            if (item == undefined)
                return null;

            var label = item.label;
            if (!item.label && item.html) {
                label = item.html;
            }
            if (!label) {
                label = "Item";
            }

            if (typeof item === 'string') {
                label = item;
            }

            var selected = false;
            if (item.selected != undefined && item.selected) {
                selected = true;
            }

            var disabled = false;
            if (item.disabled != undefined && item.disabled) {
                disabled = true;
            }

            html += '<li';

            if (disabled) {
                html += ' item-disabled="true" ';
            }

            if (item.label && !item.html) {
                html += ' item-label="' + label + '" ';
            }

            if (item.value != null) {
                html += ' item-value="' + item.value + '" ';
            }

            if (item.id != undefined) {
                html += ' id="' + item.id + '" ';
            }

            html += '>' + label;

            if (item.items) {
                if (item.subMenuWidth) {
                    html += this.loadItems(item.items, item.subMenuWidth);
                }
                else {
                    html += this.loadItems(item.items);
                }
            }

            html += '</li>';
            return html;
        },

        _setSize: function () {
            if (this.width != null && this.width.toString().indexOf("%") != -1) {
                this.host.width(this.width);
            }
            else if (this.width != null && this.width.toString().indexOf("px") != -1) {
                this.host.width(this.width);
            }
            else
                if (this.width != undefined && !isNaN(this.width)) {
                    this.host.width(this.width);
                };

            if (this.height != null && this.height.toString().indexOf("%") != -1) {
                this.host.height(this.height);
            }
            else if (this.height != null && this.height.toString().indexOf("px") != -1) {
                this.host.height(this.height);
            }
            else if (this.height != undefined && !isNaN(this.height)) {
                this.host.height(this.height);
            };
            if (this.height === null) {
                this.host.height('auto');
            }

            var me = this;
            if (this.minimizeWidth != null && this.mode != "popup") {
                var windowWidth = $(window).width();

                if (!$.jqx.response) {
                    var isDesktop = false;
                    if (navigator.userAgent.match(/Windows|Linux|MacOS/)) {
                        var isWP = navigator.userAgent.indexOf('Windows Phone') >= 0 || navigator.userAgent.indexOf('WPDesktop') >= 0 || navigator.userAgent.indexOf('IEMobile') >= 0 || navigator.userAgent.indexOf('ZuneWP7') >= 0;
                        if (!isWP) {
                            isDesktop = true;
                        }
                    }

                    var w = this.minimizeWidth;
                    if (isDesktop && this.minimizeWidth == 'auto') {
                        return;
                    }
                }

                if (this.minimizeWidth == 'auto' && $.jqx.response) {
                    var response = new $.jqx.response();
                    if (response.device.type == "Phone" || response.device.type == "Tablet") {
                        if (!this.minimized) {
                            this.minimize();
                        }
                    }
                }
                else {
                    if ((windowWidth < w) && !this.minimized) {
                        this.minimize();
                    }
                    else if (this.minimized && windowWidth >= w) {
                        this.restore()
                    }
                }
            }
        },

        minimize: function () {
            if (this.minimized) return;
            var me = this;
            this.host.addClass(this.toThemeProperty('jqx-menu-minimized'));
            this.minimized = true;
            this._tmpMode = this.mode;
            this.mode = "simple";
            var wrapper = this.host.closest('div.jqx-menu-wrapper');
            wrapper.remove();
            $("#menuWrapper" + this.element.id).remove();
            $.each(this.items, function () {
                var item = this;
                var $menuElement = $(item.element);
                var $submenu = $(item.subMenuElement);
                var $popupElement = $submenu.closest('div.jqx-menu-popup');
                $popupElement.remove();
            });

            if (this.source) {
                var html = this.loadItems(this.source);
                this.element.innerHTML = html;
                this._tmpHTML = this.element.innerHTML;
            }

            this.element.innerHTML = this._tmpHTML;
            if (this.element.innerHTML.indexOf('UL')) {
                var innerElement = this.host.find('ul:first');
                if (innerElement.length > 0) {
                    this._createMenu(innerElement[0]);
                }
            }


            this._render();
            var ul = this.host.find('ul:first');
            ul.wrap('<div class="jqx-menu-wrapper" style="z-index:' + this.popupZIndex + '; padding: 0px; display: none; margin: 0px; height: auto; width: auto; position: absolute; top: 0; left: 0; display: block; visibility: visible;"></div>')
            var wrapper = ul.closest('div.jqx-menu-wrapper');
            wrapper[0].id = "menuWrapper" + this.element.id;
            wrapper.detach();
            wrapper.appendTo($(document.body));
            wrapper.addClass(this.toThemeProperty('jqx-widget'));
            wrapper.addClass(this.toThemeProperty('jqx-menu'));
            wrapper.addClass(this.toThemeProperty('jqx-menu-minimized'));
            wrapper.addClass(this.toThemeProperty('jqx-widget-header'));

            ul.children().hide();
            wrapper.hide();
            wrapper.find('ul').addClass(this.toThemeProperty('jqx-menu-ul-minimized'));
            this.minimizedItem = $("<div></div>");
            this.minimizedItem.addClass(this.toThemeProperty('jqx-item'));
            this.minimizedItem.addClass(this.toThemeProperty('jqx-menu-item-top'));

            this.addHandler(wrapper, 'keydown', function (event) {
                return me.handleKeyDown(event);
            });

            this.minimizedItem.addClass(this.toThemeProperty('jqx-menu-minimized-button'));
            this.minimizedItem.prependTo(this.host);

            this.titleElement = $("<div>" + this.title + "</div>");
            this.titleElement.addClass(this.toThemeProperty('jqx-item'));
            this.titleElement.addClass(this.toThemeProperty('jqx-menu-title'));
            this.titleElement.prependTo(this.host);
            $("<div style='clear:both;'></div>").insertAfter(this.minimizedItem);
            me.minimizedHidden = true;
            var hideMenu = function (e) {
                me.minimizedHidden = true;
                me.minimizedItem.show();
                var fromRight = false;
                if (me.minimizedItem.css('float') == 'right') {
                    fromRight = true;
                }

                wrapper.animate({
                    left: !fromRight ? -wrapper.outerWidth() : me.host.coord().left + me.host.width() + wrapper.width(),
                    opacity: 0
                }, me.animationHideDuration, function () {
                    wrapper.find('ul:first').children().hide();
                    wrapper.hide();
                });
            }

            var toggleMenu = function (e) {
                if (me.minimizedHidden) {
                    wrapper.find('ul:first').children().show();
                    me.minimizedHidden = false;
                    wrapper.show();
                    wrapper.css('opacity', 0);
                    wrapper.css('left', -wrapper.outerWidth());
                    var fromRight = false;
                    var wrapperWidth = wrapper.width();
                    if (me.minimizedItem.css('float') == 'right') {
                        wrapper.css('left', me.host.coord().left + me.host.width() + wrapperWidth);
                        fromRight = true;
                    }
                    wrapper.css('top', me.host.coord().top + me.host.height());
                    wrapper.animate({
                        left: !fromRight ? me.host.coord().left : me.host.coord().left + me.host.width() - wrapperWidth,
                        opacity: 0.95
                    }, me.animationShowDuration, function () {
                    });
                }
                else {
                    hideMenu(e);
                }
                me._raiseEvent('2', { type: "mouse", item: me.minimizedItem[0], event: e });
                me._setSize();
            }
            this.addHandler($(window), 'orientationchange.jqxmenu' + this.element.id, function (e) {
                setTimeout(function () {
                    if (!me.minimizedHidden) {
                        var wrapperWidth = wrapper.width();
                        var fromRight = false;
                        var wrapperWidth = wrapper.width();
                        if (me.minimizedItem.css('float') == 'right') {
                            fromRight = true;
                        }
                        wrapper.css('top', me.host.coord().top + me.host.height());
                        wrapper.css({
                            left: !fromRight ? me.host.coord().left : me.host.coord().left + me.host.width() - wrapperWidth
                        });
                    }
                }, 25);
            });

            this.addHandler(this.minimizedItem, 'click', function (e) {
                toggleMenu(e);
            });
        },

        restore: function () {
            if (!this.minimized) return;

            this.host.find('ul').removeClass(this.toThemeProperty('jqx-menu-ul-minimized'));
            this.host.removeClass(this.toThemeProperty('jqx-menu-minimized'));

            this.minimized = false;
            this.mode = this._tmpMode;
            if (this.minimizedItem)
                this.minimizedItem.remove();

            var wrapper = $("#menuWrapper" + this.element.id);
            wrapper.remove();

            if (this.source) {
                var html = this.loadItems(this.source);
                this.element.innerHTML = html;
                this._tmpHTML = html;
            }

            this.element.innerHTML = this._tmpHTML;
            if (this.element.innerHTML.indexOf('UL')) {
                var innerElement = this.host.find('ul:first');
                if (innerElement.length > 0) {
                    this._createMenu(innerElement[0]);
                }
            }

            this._setSize();
            this._render();
        },

        isTouchDevice: function () {
            if (this._isTouchDevice != undefined) return this._isTouchDevice;
            var isTouchDevice = $.jqx.mobile.isTouchDevice();
            if (this.touchMode == true) {
                isTouchDevice = true;
            }
            else if (this.touchMode == false) {
                isTouchDevice = false;
            }
            if (isTouchDevice) {
                this.host.addClass(this.toThemeProperty('jqx-touch'));
                $(".jqx-menu-item").addClass(this.toThemeProperty('jqx-touch'));
            }
            this._isTouchDevice = isTouchDevice;
            return isTouchDevice;
        },

        refresh: function (initialRefresh) {
            if (!initialRefresh) {
                this._setSize();
            }
        },

        resize: function (width, height) {
            this.width = width;
            this.height = height;
            this.refresh();
        },

        _closeAll: function (e) {
            var me = e != null ? e.data : this;
            var items = me.items;
            $.each(items, function () {
                var item = this;
                if (item.hasItems == true) {
                    if (item.isOpen) {
                        me._closeItem(me, item);
                    }
                }
            });

            if (me.mode == 'popup') {
                if (e != null) {
                    var rightclick = me._isRightClick(e);
                    if (!rightclick) {
                        me.close();
                    }
                }
            }
        },

        // @param id
        // closes a menu item by id.
        closeItem: function (id) {
            if (id == null)
                return false;
            var theId = id;
            var element = document.getElementById(theId);
            var me = this;

            $.each(me.items, function () {
                var item = this;
                if (item.isOpen == true && item.element == element) {
                    me._closeItem(me, item);
                    if (item.parentId) {
                        //        me.closeItem(item.parentId);
                    }
                }
            });

            return true;
        },

        // @param id
        // opens a menu item by id.
        openItem: function (id) {
            if (id == null)
                return false;

            var theId = id;
            var element = document.getElementById(theId);
            var me = this;
            $.each(me.items, function () {
                var item = this;
                if (item.isOpen == false && item.element == element) {
                    me._openItem(me, item);
                    if (item.parentId) {
                        me.openItem(item.parentId);
                    }
                }
            });

            return true;
        },

        _getClosedSubMenuOffset: function (item) {
            var $submenu = $(item.subMenuElement);
            var top = -$submenu.outerHeight();
            var left = -$submenu.outerWidth();
            var isTopItem = item.level == 0 && this.mode == 'horizontal';
            if (isTopItem) {
                left = 0;
            }
            else {
                top = 0;
            }

            switch (item['openVerticalDirection']) {
                case 'up':
                case 'center':
                    top = $submenu.outerHeight();
                    break;
            }

            switch (item['openHorizontalDirection']) {
                case this._getDir('left'):
                    if (isTopItem) {
                        left = 0;
                    }
                    else {
                        left = $submenu.outerWidth();
                    }
                    break;
                case 'center':
                    if (isTopItem) {
                        left = 0;
                    }
                    else {
                        left = $submenu.outerWidth();
                    }
                    break;
            }
            return { left: left, top: top };
        },


        _closeItem: function (me, item, subs, force) {
            if (me == null || item == null)
                return false;


            var $submenu = $(item.subMenuElement);

            var isTopItem = item.level == 0 && this.mode == 'horizontal';
            var subMenuOffset = this._getClosedSubMenuOffset(item);
            var top = subMenuOffset.top;
            var left = subMenuOffset.left;

            var $menuElement = $(item.element);
            var $popupElement = $submenu.closest('div.jqx-menu-popup');
            if ($popupElement != null) {
                $popupElement.removeClass('show');
                var delay = me.animationHideDelay;
                if (force == true) {
                    //     clearTimeout($submenu.data('timer').hide);
                    delay = 0;
                }

                if ($submenu.data('timer') && $submenu.data('timer').show != null) {
                    clearTimeout($submenu.data('timer').show);
                    $submenu.data('timer').show = null;
                }

                var hideFunc = function () {
                    item.isOpen = false;

                    if (isTopItem) {
                        $submenu.stop().animate({ top: top }, me.animationHideDuration, function () {
                            $(item.element).removeClass(me.toThemeProperty('jqx-fill-state-pressed'));
                            $(item.element).removeClass(me.toThemeProperty('jqx-menu-item-top-selected'));

                            $(item.element).removeClass(me.toThemeProperty('jqx-rc-b-expanded'));
                            $popupElement.removeClass(me.toThemeProperty('jqx-rc-t-expanded'));
                            var $arrowSpan = $(item.arrow);
                            if ($arrowSpan.length > 0 && me.showTopLevelArrows) {
                                $arrowSpan.removeClass();
                                if (item.openVerticalDirection == 'down') {
                                    $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-down'));
                                    $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-down'));
                                }
                                else {
                                    $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-up'));
                                    $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-up'));
                                }
                            }
                            $.jqx.aria($(item.element), 'aria-expanded', false);

                            $popupElement.css({ display: 'none' });
                            if (me.animationHideDuration == 0) {
                                $submenu.css({ top: top });
                            }
                            me._raiseEvent('1', item);
                        })
                    }
                    else {
                        if (!$.jqx.browser.msie) {
                            //       $popupElement.stop().animate({ opacity: 0 }, me.animationHideDuration, function () {
                            //         });
                        }

                        $submenu.stop().animate({ left: left }, me.animationHideDuration, function () {
                            if (me.animationHideDuration == 0) {
                                $submenu.css({ left: left });
                            }

                            if (item.level > 0) {
                                $(item.element).removeClass(me.toThemeProperty('jqx-fill-state-pressed'));
                                $(item.element).removeClass(me.toThemeProperty('jqx-menu-item-selected'));
                                var $arrowSpan = $(item.arrow);
                                if ($arrowSpan.length > 0) {
                                    $arrowSpan.removeClass();
                                    if (item.openHorizontalDirection != 'left') {
                                        $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-' + me._getDir('right')));
                                        $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-' + me._getDir('right')));
                                    }
                                    else {
                                        $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-' + me._getDir('left')));
                                        $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-' + me._getDir('left')));
                                    }
                                }
                            }
                            else {
                                $(item.element).removeClass(me.toThemeProperty('jqx-fill-state-pressed'));
                                $(item.element).removeClass(me.toThemeProperty('jqx-menu-item-top-selected'));
                                var $arrowSpan = $(item.arrow);
                                if ($arrowSpan.length > 0) {
                                    $arrowSpan.removeClass();
                                    if (item.openHorizontalDirection != 'left') {
                                        $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-top-' + me._getDir('right')));
                                        $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-' + me._getDir('right')));
                                    }
                                    else {
                                        $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-top-' + me._getDir('left')));
                                        $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-' + me._getDir('left')));
                                    }
                                }
                            }
                            $.jqx.aria($(item.element), 'aria-expanded', false);
                            $popupElement.css({ display: 'none' })
                            me._raiseEvent('1', item);
                        })
                    }
                }

                if (delay > 0) {
                    if ($submenu.data('timer')) {
                        $submenu.data('timer').hide = setTimeout(function () {
                            hideFunc();
                        }, delay);
                    }
                }
                else {
                    hideFunc();
                }

                if (subs != undefined && subs) {
                    var children = $submenu.children();// find('.' + me.toThemeProperty('jqx-menu-item'));
                    $.each(children, function () {
                        if (me.menuElements[this.id] && me.menuElements[this.id].isOpen) {
                            var $submenu = $(me.menuElements[this.id].subMenuElement);
                            me._closeItem(me, me.menuElements[this.id], true, true);
                        }
                    });
                }
            }
        },

        // @param id
        // @param array.
        // get menu item's sub items.
        getSubItems: function (id, array) {
            if (id == null)
                return false;

            var me = this;
            var subItems = new Array();
            if (array != null) {
                $.extend(subItems, array);
            }

            var theId = id;
            var item = this.menuElements[theId];
            var $submenu = $(item.subMenuElement);
            var children = $submenu.find('.jqx-menu-item');
            $.each(children, function () {
                subItems[this.id] = me.menuElements[this.id];
                var innerArray = me.getSubItems(this.id, subItems);
                $.extend(subItems, innerArray);
            });

            return subItems;
        },

        // disables a menu item.
        // @param id
        // @param Boolean
        disable: function (id, disable) {
            if (id == null)
                return;
            var theId = id;
            var me = this;
            if (this.menuElements[theId]) {
                var item = this.menuElements[theId];
                item.disabled = disable;
                var $element = $(item.element);
                item.element.disabled = disable;
                $.each($element.children(), function () {
                    this.disabled = disable;
                });

                if (disable) {
                    $element.addClass(me.toThemeProperty('jqx-menu-item-disabled'));
                    $element.addClass(me.toThemeProperty('jqx-fill-state-disabled'));
                }
                else {
                    $element.removeClass(me.toThemeProperty('jqx-menu-item-disabled'));
                    $element.removeClass(me.toThemeProperty('jqx-fill-state-disabled'));
                }
            }
        },

        getItem: function (id) {
            if (this.menuElements[id]) {
                var item = this.menuElements[id];
                return item;
            }
            return null;
        },

        disableItem: function (id) {
            this.disable(id, true);
        },

        hideItem: function (id) {
            if (this.menuElements[id]) {
                var item = this.menuElements[id];
                $(item.element).hide();
            }
        },

        showItem: function (id) {
            if (this.menuElements[id]) {
                var item = this.menuElements[id];
                $(item.element).show();
            }
        },


        enableItem: function (id) {
            this.disable(id, false);
        },

        _setItemProperty: function (id, propertyname, value) {
            if (id == null)
                return;

            var theId = id;
            var me = this;

            if (this.menuElements[theId]) {
                var item = this.menuElements[theId];
                if (item[propertyname]) {
                    item[propertyname] = value;
                }
            }
        },

        // sets the open direction of an item.
        // @param id
        // @param String
        // @param String
        setItemOpenDirection: function (id, horizontal, vertical) {
            if (id == null)
                return;
            var theId = id;
            var me = this;
            var ie7 = $.jqx.browser.msie && $.jqx.browser.version < 8;

            if (this.menuElements[theId]) {
                var item = this.menuElements[theId];
                if (horizontal != null) {
                    item['openHorizontalDirection'] = horizontal;
                    if (item.hasItems && item.level > 0) {
                        var $element = $(item.element);
                        if ($element != undefined) {
                            var $arrowSpan = $(item.arrow);
                            if (item.arrow == null) {
                                $arrowSpan = $('<span id="arrow' + $element[0].id + '"></span>');
                                if (!ie7) {
                                    $arrowSpan.prependTo($element);
                                }
                                else {
                                    $arrowSpan.appendTo($element);
                                }
                                item.arrow = $arrowSpan[0];
                            }
                            $arrowSpan.removeClass();
                            if (item.openHorizontalDirection == 'left') {
                                $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-' + me._getDir('left')));
                                $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-' + me._getDir('left')));
                            }
                            else {
                                $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-' + me._getDir('right')));
                                $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-' + me._getDir('right')));
                            }
                            $arrowSpan.css('visibility', 'inherit');

                            if (!ie7) {
                                $arrowSpan.css('display', 'block');
                                $arrowSpan.css('float', 'right');
                            }
                            else {
                                $arrowSpan.css('display', 'inline-block');
                                $arrowSpan.css('float', 'none');
                            }
                        }
                    }
                }
                if (vertical != null) {
                    item['openVerticalDirection'] = vertical;
                    var $arrowSpan = $(item.arrow);
                    var $element = $(item.element);
                    if (!me.showTopLevelArrows) {
                        return;
                    }

                    if ($element != undefined) {
                        if (item.arrow == null) {
                            $arrowSpan = $('<span id="arrow' + $element[0].id + '"></span>');
                            if (!ie7) {
                                $arrowSpan.prependTo($element);
                            }
                            else {
                                $arrowSpan.appendTo($element);
                            }
                            item.arrow = $arrowSpan[0];
                        }
                        $arrowSpan.removeClass();
                        if (item.openVerticalDirection == 'down') {
                            $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-down'));
                            $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-down'));
                        }
                        else {
                            $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-up'));
                            $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-up'));
                        }
                        $arrowSpan.css('visibility', 'inherit');
                        if (!ie7) {
                            $arrowSpan.css('display', 'block');
                            $arrowSpan.css('float', 'right');
                        }
                        else {
                            $arrowSpan.css('display', 'inline-block');
                            $arrowSpan.css('float', 'none');

                        }
                    }
                }
            }
        },


        _getSiblings: function (item) {
            var siblings = new Array();
            var index = 0;
            for (var i = 0; i < this.items.length; i++) {
                if (this.items[i] == item)
                    continue;

                if (this.items[i].parentId == item.parentId && this.items[i].hasItems) {
                    siblings[index++] = this.items[i];
                }
            }
            return siblings;
        },


        _openItem: function (me, item, zIndex) {
            if (me == null || item == null)
                return false;

            if (item.isOpen)
                return false;

            if (item.disabled)
                return false;

            if (me.disabled)
                return false;
            var zIndx = me.popupZIndex;
            if (zIndex != undefined) {
                zIndx = zIndex;
            }

            var hideDuration = me.animationHideDuration;
            me.animationHideDuration = 0;
            me._closeItem(me, item, true, true);
            me.animationHideDuration = hideDuration;

            $(item.element).focus();

            //  this.host.focus();

            var popupElementoffset = [5, 5];
            var $submenu = $(item.subMenuElement);
            if ($submenu != null) {
                $submenu.stop();
            }
            // stop hiding process.
            if ($submenu.data('timer') && $submenu.data('timer').hide != null) {
                clearTimeout($submenu.data('timer').hide);
                //      $submenu.data('timer').hide = null;
            }
            var $popupElement = $submenu.closest('div.jqx-menu-popup');
            var $menuElement = $(item.element);
            var offset = item.level == 0 ? this._getOffset(item.element) : $menuElement.position()

            if (item.level > 0 && this.hasTransform) {
                var topTransform = parseInt($menuElement.coord().top) - parseInt(this._getOffset(item.element).top);
                offset.top += topTransform;
            }

            if (item.level == 0 && this.mode == 'popup') {
                offset = $menuElement.coord();
            }

            var isTopItem = item.level == 0 && this.mode == 'horizontal';

            var menuItemLeftOffset = isTopItem ? offset.left : this.menuElements[item.parentId] != null && this.menuElements[item.parentId].subMenuElement != null ? parseInt($($(this.menuElements[item.parentId].subMenuElement).closest('div.jqx-menu-popup')).outerWidth()) - popupElementoffset[0]
                : parseInt($submenu.outerWidth());

            $popupElement.css({ visibility: 'visible', display: 'block', left: menuItemLeftOffset, top: isTopItem ? offset.top + $menuElement.outerHeight() : offset.top, zIndex: zIndx })
            $submenu.css('display', 'block');

            if (this.mode != 'horizontal' && item.level == 0) {
                var hostOffset = this._getOffset(this.element)
                $popupElement.css('left', -1 + hostOffset.left + this.host.outerWidth());

                //          $popupElement.css('left', -2 + offset.left + this.host.width() - popupElementoffset[0]);
                $submenu.css('left', -$submenu.outerWidth());
            }
            else {
                var subMenuOffset = this._getClosedSubMenuOffset(item);
                $submenu.css('left', subMenuOffset.left);
                $submenu.css('top', subMenuOffset.top);
            }

            $popupElement.css({ height: parseInt($submenu.outerHeight()) + parseInt(popupElementoffset[1]) + 'px' });

            var top = 0;
            var left = 0;

            switch (item['openVerticalDirection']) {
                case 'up':
                    if (isTopItem) {
                        $submenu.css('top', $submenu.outerHeight());
                        top = popupElementoffset[1];
                        var paddingBottom = parseInt($submenu.parent().css('padding-bottom'));
                        if (isNaN(paddingBottom)) paddingBottom = 0;
                        if (paddingBottom > 0) {
                            $popupElement.addClass(this.toThemeProperty('jqx-menu-popup-clear'));
                        }

                        $submenu.css('top', $submenu.outerHeight() - paddingBottom);
                        $popupElement.css({ display: 'block', top: offset.top - $popupElement.outerHeight(), zIndex: zIndx })
                    }
                    else {
                        top = popupElementoffset[1];
                        $submenu.css('top', $submenu.outerHeight());
                        $popupElement.css({ display: 'block', top: offset.top - $popupElement.outerHeight() + popupElementoffset[1] + $menuElement.outerHeight(), zIndex: zIndx })
                    }
                    break;
                case 'center':
                    if (isTopItem) {
                        $submenu.css('top', 0);
                        $popupElement.css({ display: 'block', top: offset.top - $popupElement.outerHeight() / 2 + popupElementoffset[1], zIndex: zIndx })
                    }
                    else {
                        $submenu.css('top', 0);
                        $popupElement.css({ display: 'block', top: offset.top + $menuElement.outerHeight() / 2 - $popupElement.outerHeight() / 2 + popupElementoffset[1], zIndex: zIndx })
                    }

                    break;
            }

            switch (item['openHorizontalDirection']) {
                case this._getDir('left'):
                    if (isTopItem) {
                        $popupElement.css({ left: offset.left - ($popupElement.outerWidth() - $menuElement.outerWidth() - popupElementoffset[0]) });
                    }
                    else {
                        left = 0;
                        $submenu.css('left', $popupElement.outerWidth());
                        $popupElement.css({ left: offset.left - ($popupElement.outerWidth()) + 2 * item.level });
                    }
                    break;
                case 'center':
                    if (isTopItem) {
                        $popupElement.css({ left: offset.left - ($popupElement.outerWidth() / 2 - $menuElement.outerWidth() / 2 - popupElementoffset[0] / 2) });
                    }
                    else {
                        $popupElement.css({ left: offset.left - ($popupElement.outerWidth() / 2 - $menuElement.outerWidth() / 2 - popupElementoffset[0] / 2) });
                        $submenu.css('left', $popupElement.outerWidth());
                    }
                    break;
            }

            if (isTopItem) {
                if (parseInt($submenu.css('top')) == top) {
                    item.isOpen = true;
                    return;
                }
            }
            else if (parseInt($submenu.css('left')) == left) {
                item.isOpen == true;
                return;
            }

            $.each(me._getSiblings(item), function () {
                me._closeItem(me, this, true, true);
            });
            var hideDelay = $.data(me.element, 'animationHideDelay');
            me.animationHideDelay = hideDelay;


            if (this.autoCloseInterval > 0) {
                if (this.host.data('autoclose') != null && this.host.data('autoclose').close != null) {
                    clearTimeout(this.host.data('autoclose').close);
                }

                if (this.host.data('autoclose') != null) {
                    this.host.data('autoclose').close = setTimeout(function () {
                        me._closeAll();
                    }, this.autoCloseInterval);
                }
            }
            if ($submenu.data('timer')) {
                $submenu.data('timer').show = setTimeout(function () {
                    if ($popupElement != null) {
                        if (isTopItem) {
                            $submenu.stop();
                            $submenu.css('left', left);
                            if (!$.jqx.browser.msie) {
                                //      $popupElement.css('opacity', 0.0);
                            }

                            $menuElement.addClass(me.toThemeProperty('jqx-fill-state-pressed'));
                            $menuElement.addClass(me.toThemeProperty('jqx-menu-item-top-selected'));
                            if (item.openVerticalDirection == "down") {
                                $(item.element).addClass(me.toThemeProperty('jqx-rc-b-expanded'));
                                $popupElement.addClass(me.toThemeProperty('jqx-rc-t-expanded'));
                                $popupElement.addClass(me.toThemeProperty('show'));
                            }
                            else {
                                $(item.element).addClass(me.toThemeProperty('jqx-rc-t-expanded'));
                                $popupElement.addClass(me.toThemeProperty('jqx-rc-b-expanded'));
                                $popupElement.addClass(me.toThemeProperty('show'));
                            }

                            var $arrowSpan = $(item.arrow);
                            if ($arrowSpan.length > 0 && me.showTopLevelArrows) {
                                $arrowSpan.removeClass();
                                if (item.openVerticalDirection == 'down') {
                                    $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-down-selected'));
                                    $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-down'));
                                }
                                else {
                                    $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-up-selected'));
                                    $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-up'));
                                }
                            }

                            if (me.animationShowDuration == 0) {
                                $submenu.css({ top: top });
                                item.isOpen = true;
                                me._raiseEvent('0', item);
                                $.jqx.aria($(item.element), 'aria-expanded', true);
                            }
                            else {
                                $submenu.animate({ top: top }, me.animationShowDuration, me.easing,
                                    function () {
                                        item.isOpen = true;
                                        $.jqx.aria($(item.element), 'aria-expanded', true);
                                        me._raiseEvent('0', item);
                                    }) //animate submenu into view
                            }
                        }
                        else {
                            $submenu.stop();
                            $submenu.css('top', top);

                            $popupElement.addClass(me.toThemeProperty('show'));


                            if (!$.jqx.browser.msie) {
                                //     $popupElement.css('opacity', 0.0);
                            }

                            if (item.level > 0) {
                                $menuElement.addClass(me.toThemeProperty('jqx-fill-state-pressed'));
                                $menuElement.addClass(me.toThemeProperty('jqx-menu-item-selected'));
                                var $arrowSpan = $(item.arrow);
                                if ($arrowSpan.length > 0) {
                                    $arrowSpan.removeClass();
                                    if (item.openHorizontalDirection != 'left') {
                                        $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-' + me._getDir('right') + '-selected'));
                                        $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-' + me._getDir('right')));
                                    }
                                    else {
                                        $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-' + me._getDir('left') + '-selected'));
                                        $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-' + me._getDir('left')));
                                    }
                                }
                            }
                            else {
                                $menuElement.addClass(me.toThemeProperty('jqx-fill-state-pressed'));
                                $menuElement.addClass(me.toThemeProperty('jqx-menu-item-top-selected'));
                                var $arrowSpan = $(item.arrow);
                                if ($arrowSpan.length > 0) {
                                    $arrowSpan.removeClass();
                                    if (item.openHorizontalDirection != 'left') {
                                        $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-' + me._getDir('right') + '-selected'));
                                        $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-' + me._getDir('right')));
                                    }
                                    else {
                                        $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-' + me._getDir('left') + '-selected'));
                                        $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-' + me._getDir('left')));
                                    }
                                }
                            }
                            if (!$.jqx.browser.msie) {
                                //      $popupElement.animate({ opacity: 1 }, 2 * me.animationShowDuration, me.easing,
                                //   function () {

                                // })
                            }
                            if (me.animationShowDuration == 0) {
                                $submenu.css({ left: left });
                                me._raiseEvent('0', item);
                                item.isOpen = true;
                                $.jqx.aria($(item.element), 'aria-expanded', true);
                            }
                            else {
                                $submenu.animate({ left: left }, me.animationShowDuration, me.easing, function () {
                                    me._raiseEvent('0', item);
                                    item.isOpen = true;
                                    $.jqx.aria($(item.element), 'aria-expanded', true);
                                }) //animate submenu into view
                            }
                        }
                    }
                }, this.animationShowDelay);
            }
        },

        _getDir: function (dir) {
            switch (dir) {
                case 'left':
                    return !this.rtl ? 'left' : 'right';
                case 'right':
                    return this.rtl ? 'left' : 'right';
            }
            return 'left';
        },


        _applyOrientation: function (mode, oldmode) {
            var me = this;
            var maxHeight = 0;
            me.host.removeClass(me.toThemeProperty('jqx-menu-horizontal'));
            me.host.removeClass(me.toThemeProperty('jqx-menu-vertical'));
            me.host.removeClass(me.toThemeProperty('jqx-menu'));
            me.host.removeClass(me.toThemeProperty('jqx-widget'));
            me.host.addClass(me.toThemeProperty('jqx-widget'));
            me.host.addClass(me.toThemeProperty('jqx-menu'));

            if (mode != undefined && oldmode != undefined && oldmode == 'popup') {
                if (me.host.parent().length > 0 && me.host.parent().parent().length > 0 && me.host.parent().parent()[0] == document.body) {
                    var oldHost = $.data(document.body, 'jqxMenuOldHost' + me.element.id);
                    if (oldHost != null) {
                        var $popupElementparent = me.host.closest('div.jqx-menu-wrapper')
                        $popupElementparent.remove();
                        $popupElementparent.appendTo(oldHost);
                        me.host.css('display', 'block');
                        me.host.css('visibility', 'visible');
                        $popupElementparent.css('display', 'block');
                        $popupElementparent.css('visibility', 'visible');
                    }
                }
            }
            else if (mode == undefined && oldmode == undefined) {
                $.data(document.body, 'jqxMenuOldHost' + me.element.id, me.host.parent()[0]);
            }

            if (me.autoOpenPopup) {
                if (me.mode == 'popup') {
                    me.addHandler($(document), 'contextmenu.' + me.element.id, function (e) {
                        return false;
                    });

                    me.addHandler($(document), 'mousedown.menu' + me.element.id, function (event) {
                        me._openContextMenu(event);
                    });
                }
                else {
                    me.removeHandler($(document), 'contextmenu.' + me.element.id);
                    me.removeHandler($(document), 'mousedown.menu' + me.element.id);
                }
            }
            else {
                me.removeHandler($(document), 'contextmenu.' + me.element.id);
                me.removeHandler($(document), 'mousedown.menu' + me.element.id);
                me.addHandler($(document), 'contextmenu.' + me.element.id, function (e) {
                    if (e.target && e.target.className.indexOf && e.target.className.indexOf('jqx-menu') >= 0) {
                        return false;
                    }
                });
            }

            if (me.rtl) {
                me.host.addClass(me.toThemeProperty('jqx-rtl'));
            }

            switch (me.mode) {
                case 'horizontal':
                    me.host.addClass(me.toThemeProperty('jqx-widget-header'));
                    me.host.addClass(me.toThemeProperty('jqx-menu-horizontal'));

                    $.each(me.items, function () {
                        var item = this;
                        var $element = $(item.element);

                        var $arrowSpan = $(item.arrow);
                        $arrowSpan.removeClass();

                        if (item.hasItems && item.level > 0) {
                            var $arrowSpan = $('<span style="border: none; background-color: transparent;" id="arrow' + $element[0].id + '"></span>');
                            $arrowSpan.prependTo($element);
                            $arrowSpan.css('float', me._getDir('right'));
                            $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-' + me._getDir('right')));
                            $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-' + me._getDir('right')));
                            item.arrow = $arrowSpan[0];
                        }

                        if (item.level == 0) {
                            $(item.element).css('float', me._getDir('left'));
                            if (!item.ignoretheme && item.hasItems && me.showTopLevelArrows) {
                                var $arrowSpan = $('<span style="border: none; background-color: transparent;" id="arrow' + $element[0].id + '"></span>');
                                var ie7 = $.jqx.browser.msie && $.jqx.browser.version < 8;

                                if (item.arrow == null) {
                                    if (!ie7) {
                                        $arrowSpan.prependTo($element);
                                    }
                                    else {
                                        $arrowSpan.appendTo($element);
                                    }
                                } else {
                                    $arrowSpan = $(item.arrow);
                                }
                                if (item.openVerticalDirection == 'down') {
                                    $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-down'));
                                    $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-down'));
                                }
                                else {
                                    $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-up'));
                                    $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-up'));
                                }

                                $arrowSpan.css('visibility', 'inherit');

                                if (!ie7) {
                                    $arrowSpan.css('display', 'block');
                                    $arrowSpan.css('float', 'right');
                                }
                                else {
                                    $arrowSpan.css('display', 'inline-block');
                                }

                                item.arrow = $arrowSpan[0];
                            }
                            else if (!item.ignoretheme && item.hasItems && !me.showTopLevelArrows) {
                                if (item.arrow != null) {
                                    var $arrowSpan = $(item.arrow);
                                    $arrowSpan.remove();
                                    item.arrow = null;
                                }
                            }
                            maxHeight = Math.max(maxHeight, $element.height());
                        }
                    });
                    break;
                case 'vertical':
                case 'popup':
                case 'simple':
                    me.host.addClass(me.toThemeProperty('jqx-menu-vertical'));

                    $.each(me.items, function () {
                        var item = this;
                        var $element = $(item.element);
                        if (item.hasItems && !item.ignoretheme) {
                            if (item.arrow) {
                                $(item.arrow).remove();
                            }
                            if (me.mode == 'simple') return true;

                            var $arrowSpan = $('<span style="border: none; background-color: transparent;" id="arrow' + $element[0].id + '"></span>');

                            $arrowSpan.prependTo($element);
                            $arrowSpan.css('float', 'right');

                            if (item.level == 0) {
                                $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-top-' + me._getDir('right')));
                                $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-' + me._getDir('right')));
                            }
                            else {
                                $arrowSpan.addClass(me.toThemeProperty('jqx-menu-item-arrow-' + me._getDir('right')));
                                $arrowSpan.addClass(me.toThemeProperty('jqx-icon-arrow-' + me._getDir('right')));
                            }
                            item.arrow = $arrowSpan[0];
                        }
                        $element.css('float', 'none');
                    });

                    if (me.mode == 'popup') {
                        me.host.addClass(me.toThemeProperty('jqx-widget-content'));
                        me.host.wrap('<div tabindex=0 class="jqx-menu-wrapper" style="z-index:' + me.popupZIndex + '; border: none; background-color: transparent; padding: 0px; margin: 0px; position: absolute; top: 0; left: 0; display: block; visibility: visible;"></div>')
                        var $popupElementparent = me.host.closest('div.jqx-menu-wrapper')
                        me.host.addClass(me.toThemeProperty('jqx-popup'));
                        $popupElementparent[0].id = "menuWrapper" + me.element.id;
                        $popupElementparent.appendTo($(document.body));
                        me.addHandler($popupElementparent, 'keydown', function (event) {
                            return me.handleKeyDown(event);
                        });
                    }
                    else {
                        me.host.addClass(me.toThemeProperty('jqx-widget-header'));
                    }

                    if (me.mode == 'popup') {
                        var height = me.host.height();
                        me.host.css('position', 'absolute');
                        me.host.css('top', '0');
                        me.host.css('left', '0');
                        if (me.mode != "simple") {
                            me.host.height(height);
                            me.host.css('display', 'none');
                        }
                    }
                    break;
            }
            var isTouchDevice = me.isTouchDevice();
            if (me.autoCloseOnClick) {
                me.removeHandler($(document), 'mousedown.menu' + me.element.id, me._closeAfterClick);
                me.addHandler($(document), 'mousedown.menu' + me.element.id, me._closeAfterClick, me);
                if (isTouchDevice) {
                    me.removeHandler($(document), $.jqx.mobile.getTouchEventName('touchstart') + '.menu' + me.element.id, me._closeAfterClick, me);
                    me.addHandler($(document), $.jqx.mobile.getTouchEventName('touchstart') + '.menu' + me.element.id, me._closeAfterClick, me);
                }
            }
        },

        _getBodyOffset: function () {
            var top = 0;
            var left = 0;
            if ($('body').css('border-top-width') != '0px') {
                top = parseInt($('body').css('border-top-width'));
                if (isNaN(top)) top = 0;
            }
            if ($('body').css('border-left-width') != '0px') {
                left = parseInt($('body').css('border-left-width'));
                if (isNaN(left)) left = 0;
            }
            return { left: left, top: top };
        },

        _getOffset: function (object) {
            //       var scrollTop = $(window).scrollTop();
            //       var scrollLeft = $(window).scrollLeft();
            var isSafari = $.jqx.mobile.isSafariMobileBrowser();

            var offset = $(object).coord(true);
            var top = offset.top;
            var left = offset.left;

            if ($('body').css('border-top-width') != '0px') {
                top = parseInt(top) + this._getBodyOffset().top;
            }
            if ($('body').css('border-left-width') != '0px') {
                left = parseInt(left) + this._getBodyOffset().left;
            }

            var windowsPhone = $.jqx.mobile.isWindowsPhone();
            var touchDevice = $.jqx.mobile.isTouchDevice();

            if (this.hasTransform || (isSafari != null && isSafari) || windowsPhone || touchDevice) {
                var point = { left: $.jqx.mobile.getLeftPos(object), top: $.jqx.mobile.getTopPos(object) };
                return point;
            }
            else return { left: left, top: top };
        },

        _isRightClick: function (e) {
            var rightclick;
            if (!e) var e = window.event;
            if (e.which) rightclick = (e.which == 3);
            else if (e.button) rightclick = (e.button == 2);
            return rightclick;
        },

        _openContextMenu: function (e) {
            var me = this;
            var rightclick = me._isRightClick(e);

            if (rightclick) {
                me.open(parseInt(e.clientX) + 5, parseInt(e.clientY) + 5);
            }
        },

        // closes a context menu.
        close: function () {
            var me = this;
            if (!this.element) {
                return;
            }

            var opened = $.data(this.element, 'contextMenuOpened' + this.element.id);
            if (opened) {
                var host = this.host;
                me.host.removeClass('jqx-popup-show');

                $.each(me.items, function () {
                    var item = this;
                    if (item.hasItems) {
                        me._closeItem(me, item);
                    }
                });

                $.each(me.items, function () {
                    var item = this;
                    if (item.isOpen == true) {
                        var $submenu = $(item.subMenuElement);
                        var $popupElement = $submenu.closest('div.jqx-menu-popup')
                        $popupElement.hide(this.animationHideDuration);

                    }
                });

                this.host.hide(this.animationHideDuration);
                $.data(me.element, 'contextMenuOpened' + this.element.id, false);
                me._raiseEvent('1', me);
                me._raiseEvent('5');
            }
        },

        // @param String. Horizontal offset
        // @param String. Vertical Offset
        // opens a context menu.
        open: function (left, top) {
            if (this.mode == 'popup') {
                var duration = 0;
                if (this.host.css('display') == 'block') {
                    this.close();
                    duration = this.animationHideDuration;
                }

                var me = this;

                if (left == undefined || left == null) left = 0;
                if (top == undefined || top == null) top = 0;

                setTimeout(function () {
                    me.host.show(me.animationShowDuration);
                    me.host.css('visibility', 'visible');
                    me.host.addClass('jqx-popup-show');
                    $.data(me.element, 'contextMenuOpened' + me.element.id, true);
                    me._raiseEvent('0', me);
                    me._raiseEvent('4', { left: left, top: top });
                    me.host.css('z-index', me.popupZIndex);

                    if (left != undefined && top != undefined) {
                        me.host.css({ 'left': left, 'top': top });
                    }
                    me.focus();
                }, duration);
            }
        },

        _renderHover: function ($menuElement, item, isTouchDevice) {
            var me = this;
            if (!item.ignoretheme) {
                this.addHandler($menuElement, 'mouseenter', function () {
                    me.hoveredItem = item;
                    if (!item.disabled && !item.separator && me.enableHover && !me.disabled) {
                        if (item.level > 0) {
                            $menuElement.addClass(me.toThemeProperty('jqx-fill-state-hover'));
                            $menuElement.addClass(me.toThemeProperty('jqx-menu-item-hover'));
                        }
                        else {
                            $menuElement.addClass(me.toThemeProperty('jqx-fill-state-hover'));
                            $menuElement.addClass(me.toThemeProperty('jqx-menu-item-top-hover'));
                        }
                    }
                });
                this.addHandler($menuElement, 'mouseleave', function () {
                    if (!item.disabled && !item.separator && me.enableHover && !me.disabled) {
                        if (item.level > 0) {
                            $menuElement.removeClass(me.toThemeProperty('jqx-fill-state-hover'));
                            $menuElement.removeClass(me.toThemeProperty('jqx-menu-item-hover'));
                        }
                        else {
                            $menuElement.removeClass(me.toThemeProperty('jqx-fill-state-hover'));
                            $menuElement.removeClass(me.toThemeProperty('jqx-menu-item-top-hover'));
                        }
                    }
                });
            }
        },

        _closeAfterClick: function (event) {
            var me = event != null ? event.data : this;
            var matches = false;
            if (me.autoCloseOnClick) {
                $.each($(event.target).parents(), function () {
                    if (this.className.indexOf) {
                        if (this.className.indexOf('jqx-menu') != -1) {
                            matches = true;
                            return false;
                        }
                    }
                });

                if (!matches) {
                    event.data = me;
                    me._closeAll(event);
                }
            }
        },

        _autoSizeHorizontalMenuItems: function () {
            var me = this;
            if (me.autoSizeMainItems && this.mode == "horizontal") {
                var maxHeight = this.maxHeight;
                if (parseInt(maxHeight) > parseInt(this.host.height())) {
                    maxHeight = parseInt(this.host.height());
                }
                maxHeight = parseInt(this.host.height());

                // align vertically the items.
                $.each(this.items, function () {
                    var item = this;
                    var $element = $(item.element);
                    if (item.level == 0 && maxHeight > 0) {
                        var childrenHeight = $element.children().length > 0 ? parseInt($element.children().height()) : $element.height();
                        // vertically align content.
                        var $ul = me.host.find('ul:first');
                        var paddingOffset = parseInt($ul.css('padding-top'));
                        var marginOffset = parseInt($ul.css('margin-top'));
                        //   var borderOffset = parseInt(me.host.css('border-top-width'));
                        var height = maxHeight - 2 * (marginOffset + paddingOffset);
                        var newPadding = parseInt(height) / 2 - childrenHeight / 2;
                        var topPadding = parseInt(newPadding);
                        var bottomPadding = parseInt(newPadding);
                        $element.css('padding-top', topPadding);
                        $element.css('padding-bottom', bottomPadding);

                        if (parseInt($element.outerHeight()) > height) {
                            var offset = 1;
                            $element.css('padding-top', topPadding - offset);
                            topPadding = topPadding - offset;
                        }
                    }
                });
            }
            $.each(this.items, function () {
                var item = this;
                var $element = $(item.element);
                if (item.hasItems && item.level > 0) {
                    if (item.arrow) {
                        var $arrowSpan = $(item.arrow);
                        var height = $(item.element).height();
                        if (height > 15) {
                            $arrowSpan.css('margin-top', (height - 15) / 2);
                        }
                    }
                }
            });
        },

        _nextVisibleItem: function (item, level) {
            if (item == null || item == undefined)
                return null;

            var currentItem = item;
            while (currentItem != null) {
                currentItem = currentItem.nextItem;
                if (this._isVisible(currentItem) && !currentItem.disabled && currentItem.type !== "separator") {
                    if (this.minimized) {
                        return currentItem;
                    }

                    if (level != undefined) {
                        if (currentItem && currentItem.level != level)
                            continue;
                    }

                    return currentItem;
                }
            }

            return null;
        },

        _prevVisibleItem: function (item, level) {
            if (item == null || item == undefined)
                return null;

            var currentItem = item;
            while (currentItem != null) {
                currentItem = currentItem.prevItem;
                if (this._isVisible(currentItem) && !currentItem.disabled && currentItem.type !== "separator") {
                    if (this.minimized) {
                        return currentItem;
                    }

                    if (level != undefined) {
                        if (currentItem && currentItem.level != level)
                            continue;
                    }
                    return currentItem;
                }
            }

            return null;
        },

        _parentItem: function (item) {
            if (item == null || item == undefined)
                return null;

            var parent = item.parentElement;
            if (!parent) return null;
            var parentItem = null;

            $.each(this.items, function () {
                if (this.element == parent) {
                    parentItem = this;
                    return false;
                }
            });

            return parentItem;
        },

        _isElementVisible: function (element) {
            if (element == null)
                return false;

            if ($(element).css('display') != 'none' && $(element).css('visibility') != 'hidden') {
                return true;
            }

            return false;
        },

        _isVisible: function (item) {
            if (item == null || item == undefined)
                return false;

            if (!this._isElementVisible(item.element))
                return false;

            var currentItem = this._parentItem(item);

            if (currentItem == null)
                return true;

            if (this.minimized)
                return true;

            if (currentItem != null) {
                if (!this._isElementVisible(currentItem.element)) {
                    return false;
                }

                if (currentItem.isOpen || this.minimized) {
                    while (currentItem != null) {
                        currentItem = this._parentItem(currentItem);
                        if (currentItem != null && !this._isElementVisible(currentItem.element)) {
                            return false;
                        }

                        if (currentItem != null && !currentItem.isOpen)
                            return false;
                    }
                }
                else {
                    return false;
                }
            }

            return true;
        },

        _render: function (mode, oldMode) {
            if (this.disabled) {
                this.host.addClass(this.toThemeProperty('jqx-fill-state-disabled'));
                this.host.addClass(this.toThemeProperty('jqx-menu-disabled'));
            }
            if (this.host.attr('tabindex') == undefined) {
                this.host.attr('tabindex', 0);
            }
            var zIndex = this.popupZIndex;
            var popupElementoffset = [5, 5];
            var me = this;
            $.data(me.element, 'animationHideDelay', me.animationHideDelay);
            var isTouchDevice = this.isTouchDevice();

            var WP = isTouchDevice && ($.jqx.mobile.isWindowsPhone() || navigator.userAgent.indexOf('Touch') >= 0);
            var WPTablet = false;
            if (navigator.platform.toLowerCase().indexOf('win') != -1) {
                if (navigator.userAgent.indexOf('Windows Phone') >= 0 || navigator.userAgent.indexOf('WPDesktop') >= 0 || navigator.userAgent.indexOf('IEMobile') >= 0 || navigator.userAgent.indexOf('ZuneWP7') >= 0) {
                    this.touchDevice = true;
                }
                else {
                    if (navigator.userAgent.indexOf('Touch') >= 0) {
                        var supported = ('MSPointerDown' in window);
                        if (supported || $.jqx.mobile.isWindowsPhone() || navigator.userAgent.indexOf('ARM') >= 0) {
                            WPTablet = true;
                            WP = true;
                            me.clickToOpen = true;
                            me.autoCloseOnClick = false;
                            me.enableHover = false;
                        }
                    }
                }
            }
            $.data(document.body, 'menuel', this);

            this.hasTransform = $.jqx.utilities.hasTransform(this.host);

            this._applyOrientation(mode, oldMode);
            this.removeHandler(this.host, 'blur');
            this.removeHandler(this.host, 'focus');
            this.addHandler(this.host, 'blur', function (event) {
                if (me.keyboardNavigation) {
                    if (me.activeItem) {
                        if (me.mode === "popup") {
                            if (document.activeElement && document.activeElement.className.indexOf('jqx-menu-wrapper') >= 0) {
                                return;
                            }
                        }
                        $(me.activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                        me.activeItem = null;
                    }
                }
            });
            this.addHandler(this.host, 'focus', function (event) {
                if (me.keyboardNavigation) {
                    if (!me.activeItem) {
                        if (me.hoveredItem) {
                            $(me.hoveredItem.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                            me.activeItem = me.hoveredItem;
                        }
                        else {
                            var setActiveItem = function () {
                                if (!$.jqx.isHidden($(me.items[0].element))) {
                                    $(me.items[0].element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                    me.activeItem = me.items[0];
                                }
                                else {
                                    var item = me._nextVisibleItem(me.items[0], 0);
                                    if (item) {
                                        $(item.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                        me.activeItem = item;
                                    }
                                }
                            }

                            if (!me.activeItem) {
                                setActiveItem();
                            }
                            else {
                                if (!$.jqx.isHidden($(me.activeItem.element))) {
                                    $(me.activeItem.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                }
                                else {
                                    $(me.activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                                    setActiveItem();
                                }
                            }
                        }
                    }
                }
            });
            this.removeHandler(this.host, 'keydown.menu' + this.element.id);
            me.handleKeyDown = function (event) {
                if (me.keyboardNavigation) {
                    if (event.target.nodeName.toLowerCase() === "input") {
                        return true;
                    }

                    var activeItem = null;
                    var selectedItem = null;

                    $.each(me.items, function () {
                        var item = this;
                        if (this.disabled)
                            return true;

                        if (this.element.className.indexOf('pressed') >= 0) {
                            selectedItem = this;
                        }

                        if (this.element.className.indexOf('focus') >= 0) {
                            activeItem = this;
                            return false;
                        }
                    });


                    if (!activeItem && selectedItem) {
                        activeItem = selectedItem;
                        return false;
                    }
                    if (!activeItem) {
                        $(me.items[0].element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                        me.activeItem = me.items[0];
                        activeItem = me.activeItem;
                        return false;
                    }

                    var handled = false;
                    if (event.keyCode == 27) {
                        event.data = me;
                        me._closeAll(event);
                        if (activeItem) {
                            var item = activeItem;
                            while (item != null) {
                                if (item.parentItem) {
                                    item = item.parentItem;
                                }
                                else {
                                    $(me.activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                                    me.activeItem = item;
                                    $(me.activeItem.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                    item = item.parentItem;
                                }
                            }
                        }
                        handled = true;
                    }

                    if (event.keyCode == 13) {
                        if (activeItem) {
                            handled = true;
                            me._raiseEvent('2', { item: activeItem.element, event: event, type: "keyboard" });

                            var anchor = activeItem.anchor != null ? $(activeItem.anchor) : null;

                            if (anchor != null && anchor.length > 0) {
                                var href = anchor.attr('href');
                                var target = anchor.attr('target');
                                if (href != null) {
                                    if (target != null) {
                                        window.open(href, target);
                                    }
                                    else {
                                        window.location = href;
                                    }
                                }

                            }
                            event.preventDefault();
                            event.stopPropagation();
                            $(activeItem.element).focus();
                        }
                    }

                    var getSiblings = function (activeItem) {
                        if (activeItem == null)
                            return new Array();

                        var siblings = new Array();
                        var index = 0;
                        for (var i = 0; i < me.items.length; i++) {
                            if (me.items[i].parentId == activeItem.parentId) {
                                siblings[index++] = me.items[i];
                            }
                        }
                        return siblings;
                    }

                    var arrowKey = "";
                    switch (event.keyCode) {
                        case 40:
                            arrowKey = "down";
                            break;
                        case 38:
                            arrowKey = "up";
                            break;
                        case 39:
                            arrowKey = "right";
                            break;
                        case 37:
                            arrowKey = "left";
                            break;
                    }

                    if (activeItem && activeItem.openHorizontalDirection === "left" && arrowKey === "left") {
                        arrowKey = "right";
                    }
                    if (activeItem && activeItem.openHorizontalDirection === "left" && arrowKey === "right") {
                        arrowKey = "left";
                    }
                    if (activeItem && activeItem.openVerticalDirection === "top" && arrowKey === "top") {
                        arrowKey = "bottom";
                    }
                    if (activeItem && activeItem.openVerticalDirection === "top" && arrowKey === "bottom") {
                        arrowKey = "top";
                    }

                    if (me.rtl) {
                        if (arrowKey === "right")
                            arrowKey = "left";
                        else if (arrowKey === "left")
                            arrowKey = "right";
                    }


                    if (arrowKey === "right" && !me.minimized) {
                        if (event.altKey && (activeItem.level != 0 && activeItem.hasItems || me.mode != "horizontal")) {
                            me._openItem(me, activeItem);
                        }
                        else {
                            var itemToFocus = me._nextVisibleItem(activeItem, 0);
                            var subItem = me._nextVisibleItem(activeItem);
                            var siblings = getSiblings(subItem);

                            if (!itemToFocus) {
                                itemToFocus = subItem;
                            }

                            if (itemToFocus && ((itemToFocus.parentId === activeItem.parentId && itemToFocus.level == 0 && me.mode == "horizontal") || (subItem.id == siblings[0].id && subItem.level != 0))) {
                                if (subItem.id == siblings[0].id && ((activeItem.level != 0) || (activeItem.level == 0 && me.mode != "horizontal"))) {
                                    itemToFocus = subItem;
                                }

                                $(itemToFocus.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                $(activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                                me.activeItem = itemToFocus;
                            }
                        }

                        event.preventDefault();
                        event.stopPropagation();
                    }

                    if (arrowKey === "left" && !me.minimized) {
                        if (event.altKey && ((activeItem.level != 0 && me.mode !== "horizontal") || (activeItem.level > 1 && me.mode === "horizontal") || (activeItem.level == 1 && activeItem.hasItems && me.mode === "horizontal"))) {
                            if (activeItem.hasItems) {
                                me._closeItem(me, activeItem);
                            }
                            else {
                                if (activeItem.parentItem) {
                                    me._closeItem(me, activeItem.parentItem);
                                    $(activeItem.parentItem.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                    $(activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                                    me.activeItem = activeItem.parentItem;
                                }
                            }
                        }
                        else {
                            var itemToFocus = me._prevVisibleItem(activeItem, 0);
                            var currentItemToFocus = activeItem.parentItem;

                            if (itemToFocus && (itemToFocus.parentId === activeItem.parentId && itemToFocus.level == 0 && me.mode == "horizontal")) {
                                $(itemToFocus.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                $(activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                                me.activeItem = itemToFocus;
                            }
                            else if (!(currentItemToFocus && currentItemToFocus.level == 0 && me.mode == "horizontal") && currentItemToFocus && currentItemToFocus.level == activeItem.level - 1) {
                                $(currentItemToFocus.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                $(activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                                me.activeItem = currentItemToFocus;
                            }

                        }
                        event.preventDefault();
                        event.stopPropagation();
                    }

                    if (arrowKey === "down") {
                        if (event.altKey) {
                            if (activeItem.level == 0 && activeItem.hasItems) {
                                me._openItem(me, activeItem);
                            }
                            if (me.minimized) {
                                if (me.minimizedHidden) {
                                    me.minimizedItem.trigger('click');
                                }
                            }
                        }
                        else {
                            var itemToFocus = me._nextVisibleItem(activeItem, activeItem.level);
                            var siblings = getSiblings(itemToFocus);
                            if (me.minimized && itemToFocus) {
                                $(itemToFocus.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                $(activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                                me.activeItem = itemToFocus;
                            }
                            else {
                                if (itemToFocus && (itemToFocus.parentId === activeItem.parentId || (itemToFocus.id == siblings[0].id && me.mode == "horizontal"))) {
                                    if (!(itemToFocus.level == 0 && me.mode == "horizontal")) {
                                        $(itemToFocus.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                        $(activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                                        me.activeItem = itemToFocus;
                                    }
                                }
                                if (me.mode === "horizontal" && activeItem.level === 0 && activeItem.isOpen && activeItem.hasItems) {
                                    var itemToFocus = me._nextVisibleItem(activeItem);
                                    $(itemToFocus.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                    $(activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                                    me.activeItem = itemToFocus;
                                }
                            }
                        }

                        event.preventDefault();
                        event.stopPropagation();
                    }
                    else if (arrowKey === "up") {
                        if (event.altKey) {
                            if (activeItem.parentItem && activeItem.parentItem.level == 0) {
                                me._closeItem(me, activeItem.parentItem);
                                $(activeItem.parentItem.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                $(activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                                me.activeItem = activeItem.parentItem;
                            }
                            else if (activeItem.parentItem === null && activeItem.level === 0 && me.mode === "horizontal") {
                                me._closeItem(me, activeItem);
                            }
                            if (me.minimized) {
                                if (!me.minimizedHidden) {
                                    me.minimizedItem.trigger('click');
                                }
                            }
                        }
                        else {
                            var itemToFocus = me._prevVisibleItem(activeItem, activeItem.level);
                            var siblings = getSiblings(activeItem);

                            if (me.minimized && itemToFocus) {
                                $(itemToFocus.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                $(activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                                me.activeItem = itemToFocus;
                            }
                            else {
                                if (itemToFocus && (itemToFocus.parentId === activeItem.parentId || (itemToFocus.id == activeItem.parentId && itemToFocus.level == 0 && me.mode == "horizontal"))) {
                                    if (!(itemToFocus.level == 0 && me.mode === "horizontal" && activeItem.level === 0)) {
                                        $(itemToFocus.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                        $(activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                                        me.activeItem = itemToFocus;
                                    }
                                }
                                else if (activeItem && activeItem.id == siblings[0].id && activeItem.parentItem && activeItem.parentItem.level === 0 && me.mode === "horizontal") {
                                    var itemToFocus = activeItem.parentItem;
                                    $(itemToFocus.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                    $(activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                                    me.activeItem = itemToFocus;
                                }
                            }
                        }
                        event.preventDefault();
                        event.stopPropagation();
                    }

                    if (event.keyCode == 9) {
                        var itemToFocus = event.shiftKey ? me._prevVisibleItem(activeItem) : me._nextVisibleItem(activeItem);

                        if (itemToFocus) {
                            $(itemToFocus.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                            $(activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                            me.activeItem = itemToFocus;
                            event.preventDefault();
                            event.stopPropagation();
                        }
                        else if (me.lockFocus) {
                            var siblings = new Array();
                            var index = 0;
                            for (var i = 0; i < me.items.length; i++) {
                                if (me.items[i] == activeItem)
                                    continue;

                                if (me.items[i].parentId == activeItem.parentId) {
                                    siblings[index++] = me.items[i];
                                }
                            }

                            if (siblings.length > 0) {
                                if (event.shiftKey) {
                                    $(siblings[siblings.length - 1].element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                    me.activeItem = siblings[siblings.length - 1];
                                }
                                else {
                                    $(siblings[0].element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                                    me.activeItem = siblings[0];
                                }
                                $(activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                            }
                            event.preventDefault();
                            event.stopPropagation();
                        }
                        else if (activeItem) {
                            $(activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                            me.activeItem = null;
                        }
                    }
                }
                else {
                    return true;
                }
            }
            this.addHandler(this.host, 'keydown.menu' + this.element.id, function (event) {
                me.handleKeyDown(event);
            });

            if (me.enableRoundedCorners) {
                this.host.addClass(me.toThemeProperty('jqx-rc-all'));
            }

            $.each(this.items, function () {
                var item = this;
                var $menuElement = $(item.element);
                $menuElement.attr('role', 'menuitem');
                if (me.enableRoundedCorners) {
                    $menuElement.addClass(me.toThemeProperty('jqx-rc-all'));
                }

                me.removeHandler($menuElement, 'click');
                me.addHandler($menuElement, 'click', function (e) {
                    if (item.disabled)
                        return;

                    if (me.disabled)
                        return;

                    if (me.keyboardNavigation) {
                        if (me.activeItem) {
                            $(me.activeItem.element).removeClass(me.toThemeProperty('jqx-fill-state-focus'));
                        }
                        me.activeItem = item;
                        $(item.element).addClass(me.toThemeProperty('jqx-fill-state-focus'));
                        if (me.minimized) {
                            e.stopPropagation();
                        }
                    }

                    me._raiseEvent('2', { type: "mouse", item: item.element, event: e });

                    if (!me.autoOpen) {
                        if (item.level > 0) {
                            if (me.autoCloseOnClick && !isTouchDevice && !me.clickToOpen) {
                                e.data = me;
                                me._closeAll(e);
                            }
                        }
                    }
                    else if (me.autoCloseOnClick && !isTouchDevice && !me.clickToOpen) {
                        if (item.closeOnClick) {
                            e.data = me;
                            me._closeAll(e);
                        }
                    }
                    if (isTouchDevice && me.autoCloseOnClick) {
                        e.data = me;
                        if (!item.hasItems) {
                            me._closeAll(e);
                        }
                    }

                    if (e.target.tagName != 'A' && e.target.tagName != 'a') {
                        var anchor = item.anchor != null ? $(item.anchor) : null;

                        if (anchor != null && anchor.length > 0) {
                            var href = anchor.attr('href');
                            var target = anchor.attr('target');
                            if (href != null) {
                                if (target != null) {
                                    window.open(href, target);
                                }
                                else {
                                    window.location = href;
                                }
                            }
                        }
                    }
                });

                me.removeHandler($menuElement, 'mouseenter');
                me.removeHandler($menuElement, 'mouseleave');

                if (!WP && me.mode != 'simple') {
                    me._renderHover($menuElement, item, isTouchDevice);
                }
                if (item.subMenuElement != null) {
                    var $submenu = $(item.subMenuElement);
                    if (me.mode == 'simple') {
                        $submenu.show();
                        return true;
                    }
                    $submenu.wrap('<div class="jqx-menu-popup ' + me.toThemeProperty('jqx-menu-popup') + '" style="border: none; background-color: transparent; z-index:' + zIndex + '; padding: 0px; margin: 0px; position: absolute; top: 0; left: 0; display: block; visibility: hidden;"><div style="background-color: transparent; border: none; position:absolute; overflow:hidden; left: 0; top: 0; right: 0; width: 100%; height: 100%;"></div></div>')
                    $submenu.css({ overflow: 'hidden', position: 'absolute', left: 0, display: 'inherit', top: -$submenu.outerHeight() })
                    $submenu.data('timer', {});
                    if (item.level > 0) {
                        $submenu.css('left', -$submenu.outerWidth());
                    }
                    else if (me.mode == 'horizontal') {
                        $submenu.css('left', 0);
                    }

                    zIndex++;
                    var $popupElement = $(item.subMenuElement).closest('div.jqx-menu-popup').css({ width: parseInt($(item.subMenuElement).outerWidth()) + parseInt(popupElementoffset[0]) + 'px', height: parseInt($(item.subMenuElement).outerHeight()) + parseInt(popupElementoffset[1]) + 'px' })
                    var $popupElementparent = $menuElement.closest('div.jqx-menu-popup')

                    if ($popupElementparent.length > 0) {
                        var oldsubleftmargin = $submenu.css('margin-left');
                        var oldsubrightmargin = $submenu.css('margin-right');
                        var oldsubleftpadding = $submenu.css('padding-left');
                        var oldsubrightpadding = $submenu.css('padding-right');

                        $popupElement.addClass('horizontal');
                        $popupElement.appendTo($popupElementparent)

                        $submenu.css('margin-left', oldsubleftmargin);
                        $submenu.css('margin-right', oldsubrightmargin);
                        $submenu.css('padding-left', oldsubleftpadding);
                        $submenu.css('padding-right', oldsubrightpadding);
                    }
                    else {
                        var oldsubleftmargin = $submenu.css('margin-left');
                        var oldsubrightmargin = $submenu.css('margin-right');
                        var oldsubleftpadding = $submenu.css('padding-left');
                        var oldsubrightpadding = $submenu.css('padding-right');

                        if (me.mode === 'horizontal') {
                            $popupElement.addClass('top');
                        }
                        else {
                            $popupElement.addClass('horizontal');
                        }
                        $popupElement.appendTo($(document.body));
                        $submenu.css('margin-left', oldsubleftmargin);
                        $submenu.css('margin-right', oldsubrightmargin);
                        $submenu.css('padding-left', oldsubleftpadding);
                        $submenu.css('padding-right', oldsubrightpadding);
                    }

                    if (!me.clickToOpen) {
                        if (isTouchDevice || WP) {
                            me.removeHandler($menuElement, $.jqx.mobile.getTouchEventName('touchstart'));
                            me.addHandler($menuElement, $.jqx.mobile.getTouchEventName('touchstart'), function (event) {
                                clearTimeout($submenu.data('timer').hide)
                                if ($submenu != null) {
                                    $submenu.stop();
                                }

                                if (item.level == 0 && !item.isOpen && me.mode != "popup") {
                                    event.data = me;
                                    me._closeAll(event);
                                }

                                if (!item.isOpen) {
                                    me._openItem(me, item);
                                }
                                else {
                                    me._closeItem(me, item, true);
                                }
                                return false;
                            });
                        }

                        if (!WP) {
                            me.addHandler($menuElement, 'mouseenter', function () {
                                if (me.autoOpen || (item.level > 0 && !me.autoOpen)) {
                                    clearTimeout($submenu.data('timer').hide)
                                }

                                if (item.parentId && item.parentId != 0) {
                                    if (me.menuElements[item.parentId]) {
                                        var openedStateOfParent = me.menuElements[item.parentId].isOpen;
                                        if (!openedStateOfParent) {
                                            return;
                                        }
                                    }
                                }

                                if (me.autoOpen || (item.level > 0 && !me.autoOpen)) {
                                    me._openItem(me, item);
                                }
                                return false;
                            });

                            me.addHandler($menuElement, 'mousedown', function () {
                                if (!me.autoOpen && item.level == 0) {
                                    clearTimeout($submenu.data('timer').hide)
                                    if ($submenu != null) {
                                        $submenu.stop();
                                    }

                                    if (!item.isOpen) {
                                        me._openItem(me, item);
                                    }
                                    else {
                                        me._closeItem(me, item, true);
                                    }
                                }
                            });

                            me.addHandler($menuElement, 'mouseleave', function (event) {
                                if (me.autoCloseOnMouseLeave) {
                                    clearTimeout($submenu.data('timer').hide)
                                    var $subMenu = $(item.subMenuElement);
                                    var position = { left: parseInt(event.pageX), top: parseInt(event.pageY) };
                                    var subMenuBounds = {
                                        left: parseInt($subMenu.coord().left), top: parseInt($subMenu.coord().top),
                                        width: parseInt($subMenu.outerWidth()), height: parseInt($subMenu.outerHeight())
                                    };

                                    var closeItem = true;
                                    if (subMenuBounds.left - 5 <= position.left && position.left <= subMenuBounds.left + subMenuBounds.width + 5) {
                                        if (subMenuBounds.top <= position.top && position.top <= subMenuBounds.top + subMenuBounds.height) {
                                            closeItem = false;
                                        }
                                    }

                                    if (closeItem) {
                                        me._closeItem(me, item, true);
                                    }
                                }
                            });

                            me.removeHandler($popupElement, 'mouseenter');
                            me.addHandler($popupElement, 'mouseenter', function () {
                                clearTimeout($submenu.data('timer').hide)
                            });

                            me.removeHandler($popupElement, 'mouseleave');
                            me.addHandler($popupElement, 'mouseleave', function (e) {
                                if (me.autoCloseOnMouseLeave) {
                                    clearTimeout($submenu.data('timer').hide)
                                    clearTimeout($submenu.data('timer').show);
                                    if ($submenu != null) {
                                        $submenu.stop();
                                    }
                                    me._closeItem(me, item, true);
                                }
                            });
                        }
                    }
                    else {
                        me.removeHandler($menuElement, 'mousedown');
                        me.addHandler($menuElement, 'mousedown', function (event) {

                            clearTimeout($submenu.data('timer').hide)
                            if ($submenu != null) {
                                $submenu.stop();
                            }

                            if (item.level == 0 && !item.isOpen) {
                                event.data = me;
                                me._closeAll(event);
                            }

                            if (!item.isOpen) {
                                me._openItem(me, item);
                            }
                            else {
                                me._closeItem(me, item, true);
                            }
                        });
                    }
                }
            });

            if (this.mode == "simple") {
                this._renderSimpleMode()
            }

            this._autoSizeHorizontalMenuItems();
            this._raiseEvent('3', this);
        },

        _renderSimpleMode: function () {
            this.host.show();
        },

        createID: function () {
            var id = Math.random() + '';
            id = id.replace('.', '');
            id = '99' + id;
            id = id / 1;
            while (this.items[id]) {
                id = Math.random() + '';
                id = id.replace('.', '');
                id = id / 1;
            }
            return 'menuItem' + id;
        },

        _createMenu: function (uiObject, refresh) {
            if (uiObject == null)
                return;

            if (refresh == undefined) {
                refresh = true;
            }
            if (refresh == null) {
                refresh = true;
            }

            var self = this;

            $(uiObject).addClass('jqx-menu-ul');

            var liTags = $(uiObject).find('li');
            var k = 0;
            this.itemMapping = new Array();

            for (var index = 0; index < liTags.length; index++) {
                var listItem = liTags[index];
                var $listItem = $(listItem);

                if (listItem.className.indexOf('jqx-menu') == -1 && this.autoGenerate == false)
                    continue;

                var id = listItem.id;
                if (!id) {
                    id = this.createID();
                }

                if (refresh) {
                    listItem.id = id;
                    this.items[k] = new $.jqx._jqxMenu.jqxMenuItem();
                    this.menuElements[id] = this.items[k];
                }

                k += 1;
                var parentId = 0;
                var me = this;
                var children = $listItem.children();
                children.each(function () {
                    if (!refresh) {
                        this.className = "";

                        if (me.autoGenerate) {
                            $(me.items[k - 1].subMenuElement)[0].className = "";
                            if (!me.minimized) {
                                $(me.items[k - 1].subMenuElement).addClass(me.toThemeProperty('jqx-widget-content'));
                            }
                            $(me.items[k - 1].subMenuElement).addClass(me.toThemeProperty('jqx-menu-dropdown'));
                            $(me.items[k - 1].subMenuElement).addClass(me.toThemeProperty('jqx-popup'));
                        }
                    }

                    if (this.className.indexOf('jqx-menu-dropdown') != -1) {
                        if (refresh) {
                            me.items[k - 1].subMenuElement = this;
                        }
                        return false;
                    }
                    else if (me.autoGenerate && (this.tagName == 'ul' || this.tagName == 'UL')) {
                        if (refresh) {
                            me.items[k - 1].subMenuElement = this;
                        }
                        this.className = "";
                        if (!me.minimized) {
                            $(this).addClass(me.toThemeProperty('jqx-widget-content'));
                        }
                        $(this).addClass(me.toThemeProperty('jqx-menu-dropdown'));
                        $(this).addClass(me.toThemeProperty('jqx-popup'));
                        $(this).attr('role', 'menu');
                        if (me.rtl) {
                            $(this).addClass(me.toThemeProperty('jqx-rc-l'));
                        }
                        else {
                            $(this).addClass(me.toThemeProperty('jqx-rc-r'));
                        }
                        $(this).addClass(me.toThemeProperty('jqx-rc-b'));

                        return false;
                    }
                });

                var parents = $listItem.parents();
                parents.each(function () {
                    if (this.className.indexOf('jqx-menu-item') != -1) {
                        parentId = this.id;
                        return false;
                    }
                    else if (me.autoGenerate && (this.tagName == 'li' || this.tagName == 'LI')) {
                        parentId = this.id;
                        return false;
                    }

                });

                var separator = false;
                var type = listItem.getAttribute('type');
                var ignoretheme = listItem.getAttribute('ignoretheme') || listItem.getAttribute('data-ignoretheme');

                if (ignoretheme) {
                    if (ignoretheme == 'true' || ignoretheme == true) {
                        ignoretheme = true;
                    }
                }
                else ignoretheme = false;

                if (!type) {
                    type = listItem.type;
                }
                else {
                    if (type == 'separator') {
                        var separator = true;
                    }
                }

                if (!separator) {
                    if (parentId) {
                        type = 'sub';
                    }
                    else type = 'top';
                }

                var menuItem = this.items[k - 1];
                if (refresh) {
                    menuItem.id = id;
                    menuItem.parentId = parentId;
                    menuItem.type = type;
                    menuItem.separator = separator;
                    menuItem.element = liTags[index];
                    var anchor = $listItem.children('a');
                    menuItem.disabled = listItem.getAttribute('item-disabled') == "true" ? true : false;

                    menuItem.level = $listItem.parents('li').length;
                    menuItem.anchor = anchor.length > 0 ? anchor : null;
                    if (menuItem.anchor) {
                        $(menuItem.anchor).attr('tabindex', -1);
                    }
                }
                menuItem.ignoretheme = ignoretheme;

                var parentItem = this.menuElements[parentId];
                if (parentItem != null) {
                    if (parentItem.ignoretheme) {
                        menuItem.ignoretheme = parentItem.ignoretheme;
                        ignoretheme = parentItem.ignoretheme;
                    }
                    menuItem.parentItem = parentItem;
                    menuItem.parentElement = parentItem.element;
                }

                if (this.autoGenerate) {
                    if (type == 'separator') {
                        $listItem.removeClass();
                        $listItem.addClass(this.toThemeProperty('jqx-menu-item-separator'));
                        $listItem.attr('role', 'separator');
                    }
                    else {
                        if (!ignoretheme) {
                            if ($listItem[0].className.indexOf("jqx-grid-menu-item-touch") >= 0) {
                                $listItem[0].className = this.toThemeProperty('jqx-grid-menu-item-touch');
                            }
                            else {
                                $listItem[0].className = "";
                            }

                            if (this.rtl) {
                                $listItem.addClass(this.toThemeProperty('jqx-rtl'));
                            }
                            if (menuItem.level > 0 && !me.minimized) {
                                $listItem.addClass(this.toThemeProperty('jqx-item'));
                                $listItem.addClass(this.toThemeProperty('jqx-menu-item'));
                            }
                            else {
                                $listItem.addClass(this.toThemeProperty('jqx-item'));
                                $listItem.addClass(this.toThemeProperty('jqx-menu-item-top'));
                            }
                        }
                    }
                }
                if (menuItem.disabled) {
                    $listItem.addClass(me.toThemeProperty('jqx-menu-item-disabled'));
                    $listItem.addClass(me.toThemeProperty('jqx-fill-state-disabled'));
                }

                this.itemMapping[index] = { element: liTags[index], item: menuItem };
                this.itemMapping["id" + liTags[index].id] = this.itemMapping[index];

                if (refresh && !ignoretheme) {
                    menuItem.hasItems = $listItem.find('li').length > 0;
                    if (menuItem.hasItems) {
                        if (menuItem.element) {
                            $.jqx.aria($(menuItem.element), "aria-haspopup", true);
                            if (!menuItem.subMenuElement.id) menuItem.subMenuElement.id = $.jqx.utilities.createId();
                            $.jqx.aria($(menuItem.element), "aria-owns", menuItem.subMenuElement.id);
                        }
                    }
                }
            }

            for (var i = 0; i < liTags.length; i++) {
                var listTag = liTags[i];
                if (this.itemMapping["id" + listTag.id]) {
                    var menuItem = this.itemMapping["id" + listTag.id].item;
                    if (!menuItem)
                        continue;

                    menuItem.prevItem = null;
                    menuItem.nextItem = null;
                    if (i > 0) {
                        if (this.itemMapping["id" + liTags[i - 1].id]) {
                            menuItem.prevItem = this.itemMapping["id" + liTags[i - 1].id].item;
                        }
                    }

                    if (i < liTags.length - 1) {
                        if (this.itemMapping["id" + liTags[i + 1].id]) {
                            menuItem.nextItem = this.itemMapping["id" + liTags[i + 1].id].item;
                        }
                    }
                }
            }
        },

        destroy: function () {
            var me = this;
            $.jqx.utilities.resize(me.host, null, true);
            var wrapper = me.host.closest('div.jqx-menu-wrapper');
            me.removeHandler(wrapper, 'keydown');
            wrapper.remove();
            me.removeHandler($("#menuWrapper" + me.element.id), 'keydown');
            $("#menuWrapper" + me.element.id).remove();
            me.removeHandler(me.host, 'keydown');
            me.removeHandler(me.host, 'focus');
            me.removeHandler(me.host, 'blur');
            me.removeHandler($(document), 'mousedown.menu' + me.element.id, me._closeAfterClick);
            me.removeHandler($(document), 'mouseup.menu' + me.element.id, me._closeAfterClick);
            me.removeHandler($(document), 'contextmenu.' + me.element.id);
            me.removeHandler(me.host, 'contextmenu.' + me.element.id);

            $.data(document.body, 'jqxMenuOldHost' + me.element.id, null);
            if (me.isTouchDevice()) {
                me.removeHandler($(document), $.jqx.mobile.getTouchEventName('touchstart') + '.menu' + me.element.id, me._closeAfterClick, this);
            }

            if ($(window).off) {
                $(window).off('resize.menu' + me.element.id);
            }
            $.each(me.items, function () {
                var item = this;
                var $menuElement = $(item.element);
                me.removeHandler($menuElement, 'click');
                me.removeHandler($menuElement, 'selectstart');
                me.removeHandler($menuElement, 'mouseenter');
                me.removeHandler($menuElement, 'mouseleave');
                me.removeHandler($menuElement, 'mousedown');
                me.removeHandler($menuElement, 'mouseleave');
                var $submenu = $(item.subMenuElement);
                var $popupElement = $submenu.closest('div.jqx-menu-popup');
                $popupElement.remove();
                delete this.subMenuElement;
                delete this.element;
            });
            $.data(document.body, 'menuel', null);
            delete me.menuElements;
            me.items = new Array();
            delete me.items;
            var vars = $.data(me.element, "jqxMenu");
            if (vars) {
                delete vars.instance;
            }

            me.host.removeClass();
            me.host.remove();
            delete me.host;
            delete me.element;
        },

        _raiseEvent: function (id, arg) {
            if (arg == undefined)
                arg = { owner: null };

            var evt = this.events[id];
            var args = arg;
            args.owner = this;

            var event = new $.Event(evt);
            if (id == '2') {
                args = arg.item;
                args.owner = this;
                args.clickType = arg.type;
                $.extend(event, arg.event);
                event.type = 'itemclick';
            }

            event.owner = this;
            event.args = args;
            var result = this.host.trigger(event);
            return result;
        },

        propertiesChangedHandler: function (object, key, value) {
            if (value.width && value.height && Object.keys(value).length == 2) {
                object._setSize();
                if (object.mode === "popup") {
                    var $popupElementparent = this.host.closest('div.jqx-menu-wrapper');
                    $popupElementparent[key](value);
                    var id = this.host[0].id;
                    $("#" + id)[key](value);
                }
            }
        },

        propertyChangedHandler: function (object, key, oldvalue, value) {
            if (this.isInitialized == undefined || this.isInitialized == false)
                return;

            if (object.batchUpdate && object.batchUpdate.width && object.batchUpdate.height && Object.keys(object.batchUpdate).length == 2) {
                return;
            }

            if (key == "disabled") {
                if (object.disabled) {
                    object.host.addClass(object.toThemeProperty('jqx-fill-state-disabled'));
                    object.host.addClass(object.toThemeProperty('jqx-menu-disabled'));
                }
                else {
                    object.host.removeClass(object.toThemeProperty('jqx-fill-state-disabled'));
                    object.host.removeClass(object.toThemeProperty('jqx-menu-disabled'));
                }
            }

            if (value == oldvalue)
                return;

            if (key == 'touchMode') {
                this._isTouchDevice = null;
                object._render(value, oldvalue);
            }

            if (key === "width" || key === "height") {
                object._setSize();
                if (object.mode === "popup") {
                    var $popupElementparent = this.host.closest('div.jqx-menu-wrapper');
                    $popupElementparent[key](value);
                    var id = this.host[0].id;
                    $("#" + id)[key](value);
                }
                return;
            }
            if (key == 'source') {
                if (object.source != null) {
                    var html = object.loadItems(object.source);
                    object.element.innerHTML = html;
                    var innerElement = object.host.find('ul:first');
                    if (innerElement.length > 0) {
                        object.refresh();
                        object._createMenu(innerElement[0]);
                        object._render();
                    }
                }
            }

            if (key == 'autoCloseOnClick') {
                if (value == false) {
                    object.removeHandler($(document), 'mousedown.menu' + this.element.id, object._closeAll);
                }
                else {
                    object.addHandler($(document), 'mousedown.menu' + this.element.id, object, object._closeAll);
                }
            }
            else if (key == 'mode' || key == 'width' || key == 'height' || key == 'showTopLevelArrows') {
                object.refresh();

                if (key == 'mode') {
                    object._render(value, oldvalue);
                }
                else object._applyOrientation();
            }
            else if (key == 'theme') {
                $.jqx.utilities.setTheme(oldvalue, value, object.host);
            }
        }
    });
})(jqxBaseFramework);

(function ($) {
    $.jqx._jqxMenu.jqxMenuItem = function (id, parentId, type) {
        var menuItem =
        {
            // gets the id.
            id: id,
            // gets the parent id.
            parentId: parentId,
            // gets the parent item instance.
            parentItem: null,
            // gets the anchor element.
            anchor: null,
            // gets the type
            type: type,
            // gets whether the item is disabled.
            disabled: false,
            // gets the item's level.
            level: 0,
            // gets a value whether the item is opened.
            isOpen: false,
            // has sub elements.
            hasItems: false,
            // li element
            element: null,
            subMenuElement: null,
            // arrow element.
            arrow: null,
            // left, right, center
            openHorizontalDirection: 'right',
            // up, down, center
            openVerticalDirection: 'down',
            closeOnClick: true
        }
        return menuItem;
    }; //
})(jqxBaseFramework);
})();



/***/ }),

/***/ 4240:
/***/ (() => {

/* tslint:disable */
/* eslint-disable */
(function(){
	if (typeof document === 'undefined') { 
		return;
	}

(function ($) {
    $.jqx.jqxWidget("jqxScrollBar", "", {});

    $.extend($.jqx._jqxScrollBar.prototype, {

        defineInstance: function () {
            var settings = {
                // Type: Number
                // Default: null
                // Sets the scrollbar height.
                height: null,
                // Type: Number
                // Default: null
                // Sets the scrollbar width.
                width: null,
                // Type: Number
                // Default: false. This means that the scrollbar is horizontally oriented by default.
                // Sets the scrollbar orientation.
                vertical: false,
                // Type: Number
                // Default: 0
                // Sets the minimum scroll value.
                min: 0,
                // Type: Number
                // Default: 0
                // Sets the maximum scroll value.
                max: 1000,
                // Type: Number
                // Default: 0
                // Sets the scroll value. The value can be between min and max.
                value: 0,
                // Type: Number
                // Default: 0
                // Sets the scroll step when any arrow button is clicked.
                step: 10,
                // Type: Number
                // Default: 0
                // Sets the scroll step when the user clicks on the empty scroll space between arrow button and thumb.
                largestep: 50,
                // Type: Number
                // Default: 10
                // sets the thumb's minimum size.
                thumbMinSize: 10,
                // Type: Number
                // Default: 0
                // sets the thumb's size.
                thumbSize: 0,
                // Type: Number or 'auto'
                // Default: 'auto'
                // sets the thumb's drag step.
                thumbStep: 'auto',
                // Type: String
                // Default: 'all'
                // sets the rounded corners string.
                roundedCorners: 'all',
                // Type: Boolean
                // Default: true
                // Sets whether the scroll buttons are visible.
                showButtons: true,
                // Type: Boolean
                // Default: false
                // Sets whether the scrollbar is disabled or not.
                disabled: false,
                // Sets whether the scrollbar is on touch device.
                touchMode: 'auto',
                touchModeStyle: 'auto',
                thumbTouchSize: 0,
                // disable jquery trigger function. It is very slow if you call it on mouse move. This could improve performance.
                _triggervaluechanged: true,
                rtl: false,
                areaDownCapture: false,
                areaUpCapture: false,
                _initialLayout: false,
                offset: 0, reference: 0, velocity: 0, frame: 0, timestamp: 0, ticker: null, amplitude: 0, target: 0

            };
            if (this === $.jqx._jqxScrollBar.prototype) {
                return settings;
            }
            $.extend(true, this, settings);
            return settings;
        },

        createInstance: function (args) {
            this.render();
        }, // createInstance

        render: function () {
            this._mouseup = new Date();
            var self = this;
            var html = "<div id='jqxScrollOuterWrap' style='box-sizing: content-box; width:100%; height: 100%; align:left; border: 0px; valign:top; position: relative;'>" +
                "<div id='jqxScrollWrap' style='box-sizing: content-box; width:100%; height: 100%; left: 0px; top: 0px; align:left; valign:top; position: absolute;'>" +
                "<div id='jqxScrollBtnUp' style='box-sizing: content-box; align:left; valign:top; left: 0px; top: 0px; position: absolute;'><div></div></div>" +
                "<div id='jqxScrollAreaUp' style='box-sizing: content-box; align:left; valign:top; left: 0px; top: 0px; position: absolute;'></div>" +
                "<div id='jqxScrollThumb' style='box-sizing: content-box; align:left; valign:top; left: 0px; top: 0px; position: absolute;'></div>" +
                "<div id='jqxScrollAreaDown' style='box-sizing: content-box; align:left; valign:top; left: 0px; top: 0px; position: absolute;'></div>" +
                "<div id='jqxScrollBtnDown' style='box-sizing: content-box; align:left; valign:top; left: 0px; top: 0px; position: absolute;'><div></div></div>" +
                "</div>" +
                "</div>";

            if ($.jqx.utilities && $.jqx.utilities.scrollBarButtonsVisibility == "hidden") {
                this.showButtons = false;
            }

            if (self.WinJS) {
                MSApp.execUnsafeLocalFunction(function () {
                    self.host.html(html);
                });
            }
            else {
                this.element.innerHTML = html;
            }

            if (this.width != undefined && parseInt(this.width) > 0) {
                this.host.width(parseInt(this.width));
            }

            if (this.height != undefined && parseInt(this.height) > 0) {
                this.host.height(parseInt(this.height));
            }
            this.isPercentage = false;
            if (this.width != null && this.width.toString().indexOf("%") != -1) {
                this.host.width(this.width);
                this.isPercentage = true;
            }

            if (this.height != null && this.height.toString().indexOf("%") != -1) {
                this.host.height(this.height);
                this.isPercentage = true;
            }
            if (this.isPercentage) {
                var that = this;
                $.jqx.utilities.resize(this.host, function () {
                    that._arrange();
                }, false);
            }
            this.thumbCapture = false;
            this.scrollOuterWrap = $(this.element.firstChild);
            this.scrollWrap = $(this.scrollOuterWrap[0].firstChild);
            this.btnUp = $(this.scrollWrap[0].firstChild);
            this.areaUp = $(this.btnUp[0].nextSibling);
            this.btnThumb = $(this.areaUp[0].nextSibling);
            this.arrowUp = $(this.btnUp[0].firstChild);
            this.areaDown = $(this.btnThumb[0].nextSibling);
            this.btnDown = $(this.areaDown[0].nextSibling);
            this.arrowDown = $(this.btnDown[0].firstChild);

            var elID = this.element.id;
            this.btnUp[0].id = "jqxScrollBtnUp" + elID;
            this.btnDown[0].id = "jqxScrollBtnDown" + elID;
            this.btnThumb[0].id = "jqxScrollThumb" + elID;
            this.areaUp[0].id = "jqxScrollAreaUp" + elID;
            this.areaDown[0].id = "jqxScrollAreaDown" + elID;
            this.scrollWrap[0].id = "jqxScrollWrap" + elID;
            this.scrollOuterWrap[0].id = "jqxScrollOuterWrap" + elID;

            if (!this.host.jqxRepeatButton) {
                throw new Error('jqxScrollBar: Missing reference to jqxbuttons.js.');
                return;
            }

            this.btnUp.jqxRepeatButton({ _ariaDisabled: true, overrideTheme: true, disabled: this.disabled });
            this.btnDown.jqxRepeatButton({ _ariaDisabled: true, overrideTheme: true, disabled: this.disabled });
            this.btnDownInstance = $.data(this.btnDown[0], 'jqxRepeatButton').instance;
            this.btnUpInstance = $.data(this.btnUp[0], 'jqxRepeatButton').instance;

            this.areaUp.jqxRepeatButton({ _scrollAreaButton: true, _ariaDisabled: true, overrideTheme: true });
            this.areaDown.jqxRepeatButton({ _scrollAreaButton: true, _ariaDisabled: true, overrideTheme: true });
            this.btnThumb.jqxButton({ _ariaDisabled: true, overrideTheme: true, disabled: this.disabled });
            this.propertyChangeMap['value'] = function (instance, key, oldVal, value) {
                if (!(isNaN(value))) {
                    if (oldVal != value) {
                        instance.setPosition(parseFloat(value), true);
                    }
                }
            }

            this.propertyChangeMap['width'] = function (instance, key, oldVal, value) {
                if (instance.width != undefined && parseInt(instance.width) > 0) {
                    instance.host.width(parseInt(instance.width));
                    instance._arrange();
                }
            }

            this.propertyChangeMap['height'] = function (instance, key, oldVal, value) {
                if (instance.height != undefined && parseInt(instance.height) > 0) {
                    instance.host.height(parseInt(instance.height));
                    instance._arrange();
                }
            }

            this.propertyChangeMap['theme'] = function (instance, key, oldVal, value) {
                instance.setTheme();
            }

            this.propertyChangeMap['max'] = function (instance, key, oldVal, value) {
                if (!(isNaN(value))) {
                    if (oldVal != value) {
                        instance.max = parseInt(value);
                        if (instance.min > instance.max)
                            instance.max = instance.min + 1;

                        instance._arrange();
                        instance.setPosition(instance.value);
                    }
                }
            }

            this.propertyChangeMap['min'] = function (instance, key, oldVal, value) {
                if (!(isNaN(value))) {
                    if (oldVal != value) {
                        instance.min = parseInt(value);
                        if (instance.min > instance.max)
                            instance.max = instance.min + 1;

                        instance._arrange();
                        instance.setPosition(instance.value);
                    }
                }
            }

            this.propertyChangeMap['disabled'] = function (instance, key, oldVal, value) {
                if (oldVal != value) {
                    if (value) {
                        instance.host.addClass(instance.toThemeProperty('jqx-fill-state-disabled'));
                    }
                    else {
                        instance.host.removeClass(instance.toThemeProperty('jqx-fill-state-disabled'));
                    }
                    instance.btnUp.jqxRepeatButton('disabled', instance.disabled);
                    instance.btnDown.jqxRepeatButton('disabled', instance.disabled);
                    instance.btnThumb.jqxButton('disabled', instance.disabled);
                }
            }

            this.propertyChangeMap['touchMode'] = function (instance, key, oldVal, value) {
                if (oldVal != value) {
                    instance._updateTouchBehavior();
                    if (value === true) {
                        instance.showButtons = false;
                        instance.refresh();
                    }
                    else if (value === false) {
                        instance.showButtons = true;
                        instance.refresh();
                    }
                }
            }

            this.propertyChangeMap['rtl'] = function (instance, key, oldVal, value) {
                if (oldVal != value) {
                    instance.refresh();
                }
            }

            this.buttonUpCapture = false;
            this.buttonDownCapture = false;
            this._updateTouchBehavior();
            this.setPosition(this.value);
            this._addHandlers();
            this.setTheme();
        },

        resize: function (width, height) {
            this.width = width;
            this.height = height;
            this._arrange();
        },

        _updateTouchBehavior: function () {
            this.isTouchDevice = $.jqx.mobile.isTouchDevice();
            if (this.touchMode == true) {
                if ($.jqx.browser.msie && $.jqx.browser.version < 9) {
                    this.setTheme();
                    return;
                }

                this.isTouchDevice = true;
                $.jqx.mobile.setMobileSimulator(this.btnThumb[0]);
                this._removeHandlers();
                this._addHandlers();
                this.setTheme();
            }
            else if (this.touchMode == false) {
                this.isTouchDevice = false;
            }
        },

        _addHandlers: function () {
            var self = this;

            var touchSupport = false;
            try {
                if (('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch) {
                    touchSupport = true;
                    this._touchSupport = true;
                }
            }
            catch (err) {
            }

            if (self.isTouchDevice || touchSupport) {
                this.addHandler(this.btnThumb, $.jqx.mobile.getTouchEventName('touchend'), function (event) {
                    var btnThumbPressedClass = self.vertical ? self.toThemeProperty('jqx-scrollbar-thumb-state-pressed') : self.toThemeProperty('jqx-scrollbar-thumb-state-pressed-horizontal');
                    var btnThumbPressedFillClass = self.toThemeProperty('jqx-fill-state-pressed');
                    self.btnThumb.removeClass(btnThumbPressedClass);
                    self.btnThumb.removeClass(btnThumbPressedFillClass);
                    if (!self.disabled) self.handlemouseup(self, event);
                    return false;
                });

                this.addHandler(this.btnThumb, $.jqx.mobile.getTouchEventName('touchstart'), function (event) {
                    if (!self.disabled) {
                        if (self.touchMode == true) {
                            event.clientX = event.originalEvent.clientX;
                            event.clientY = event.originalEvent.clientY;
                        }
                        else {
                            var e = event;
                            if (e.originalEvent.touches && e.originalEvent.touches.length) {
                                event.clientX = e.originalEvent.touches[0].clientX;
                                event.clientY = e.originalEvent.touches[0].clientY;
                            }
                            else {
                                event.clientX = event.originalEvent.clientX;
                                event.clientY = event.originalEvent.clientY;
                            }
                        }

                        self.handlemousedown(event);
                        if (event.preventDefault) {
                            event.preventDefault();
                        }
                    }
                });

                $.jqx.mobile.touchScroll(this.element, self.max, function (left, top, dx, dy, event) {
                    if (self.host.css('visibility') == 'visible') {
                        if (event) {
                            if (self.touchMode == true) {
                                event.clientX = event.originalEvent.clientX;
                                event.clientY = event.originalEvent.clientY;
                            }
                            else {
                                var e = event;
                                if (e.originalEvent.touches && e.originalEvent.touches.length) {
                                    event.clientX = e.originalEvent.touches[0].clientX;
                                    event.clientY = e.originalEvent.touches[0].clientY;
                                }
                                else {
                                    event.clientX = event.originalEvent.clientX;
                                    event.clientY = event.originalEvent.clientY;
                                }
                            }
                        }

                        var btnThumbPressedClass = self.vertical ? self.toThemeProperty('jqx-scrollbar-thumb-state-pressed') : self.toThemeProperty('jqx-scrollbar-thumb-state-pressed-horizontal');
                        self.btnThumb.addClass(btnThumbPressedClass);
                        self.btnThumb.addClass(self.toThemeProperty('jqx-fill-state-pressed'));
                        self.thumbCapture = true;
                        self.element.setAttribute('touched', '');
                        self.handlemousemove(event);
                    }
                }, self.element.id, self.host, self.host);
            }


            if (!this.isTouchDevice) {
                try {
                    if (document.referrer != "" || window.frameElement) {
                        if (window.top != null && window.top != window.self) {
                            var parentLocation = null;
                            if (window.parent && document.referrer) {
                                parentLocation = document.referrer;
                            }

                            if (parentLocation && parentLocation.indexOf(document.location.host) != -1) {
                                var eventHandle = function (event) {
                                    if (!self.disabled) self.handlemouseup(self, event);
                                };

                                if (window.top.document.addEventListener) {
                                    window.top.document.addEventListener('mouseup', eventHandle, false);

                                } else if (window.top.document.attachEvent) {
                                    window.top.document.attachEvent("on" + 'mouseup', eventHandle);
                                }
                            }
                        }
                    }
                }
                catch (error) {
                }
                var eventNames = 'click mouseup mousedown';

                this.addHandler(this.btnDown, eventNames, function (event) {
                    var step = self.step;

                    if (Math.abs(self.max - self.min) <= step)
                        step = 1;

                    if (self.rtl && !self.vertical)
                        step = -self.step;

                    switch (event.type) {
                        case 'click':

                            if (self.buttonDownCapture && !self.isTouchDevice) {
                                if (!self.disabled)
                                    self.setPosition(self.value + step)
                            }
                            else if (!self.disabled && self.isTouchDevice) {
                                self.setPosition(self.value + step);
                            }
                            break;
                        case 'mouseup':
                            if (!self.btnDownInstance.base.disabled && self.buttonDownCapture) {
                                self.buttonDownCapture = false;
                                self.btnDown.removeClass(self.toThemeProperty('jqx-scrollbar-button-state-pressed'));
                                self.btnDown.removeClass(self.toThemeProperty('jqx-fill-state-pressed'));
                                self._removeArrowClasses('pressed', 'down');
                                self.handlemouseup(self, event);

                                self.setPosition(self.value + step)
                                return false;
                            }
                            break;
                        case 'mousedown':
                            if (!self.btnDownInstance.base.disabled) {
                                self.buttonDownCapture = true;
                                self.btnDown.addClass(self.toThemeProperty('jqx-fill-state-pressed'));
                                self.btnDown.addClass(self.toThemeProperty('jqx-scrollbar-button-state-pressed'));
                                self._addArrowClasses('pressed', 'down');
                                return false;
                            }
                            break;
                    }
                });

                this.addHandler(this.btnUp, eventNames, function (event) {
                    var step = self.step;

                    if (Math.abs(self.max - self.min) <= step)
                        step = 1;

                    if (self.rtl && !self.vertical)
                        step = -self.step;

                    switch (event.type) {
                        case 'click':
                            if (self.buttonUpCapture && !self.isTouchDevice) {
                                if (!self.disabled) {
                                    self.setPosition(self.value - step);
                                }
                            }
                            else if (!self.disabled && self.isTouchDevice) {
                                self.setPosition(self.value - step);
                            }
                            break;
                        case 'mouseup':
                            if (!self.btnUpInstance.base.disabled && self.buttonUpCapture) {
                                self.buttonUpCapture = false;
                                self.btnUp.removeClass(self.toThemeProperty('jqx-scrollbar-button-state-pressed'));
                                self.btnUp.removeClass(self.toThemeProperty('jqx-fill-state-pressed'));
                                self._removeArrowClasses('pressed', 'up');
                                self.handlemouseup(self, event);

                                self.setPosition(self.value - step)
                                return false;
                            }
                            break;
                        case 'mousedown':
                            if (!self.btnUpInstance.base.disabled) {
                                self.buttonUpCapture = true;
                                self.btnUp.addClass(self.toThemeProperty('jqx-fill-state-pressed'));
                                self.btnUp.addClass(self.toThemeProperty('jqx-scrollbar-button-state-pressed'));
                                self._addArrowClasses('pressed', 'up');
                                return false;
                            }
                            break;
                    }
                });
            }

            var eventName = 'click';
            if (this.isTouchDevice) {
                eventName = $.jqx.mobile.getTouchEventName('touchend');
            }

            this.addHandler(this.areaUp, eventName, function (event) {
                if (!self.disabled) {
                    var step = self.largestep;
                    if (self.rtl && !self.vertical) {
                        step = -self.largestep;
                    }

                    var canSetPosition = true;
                    var thumbOffset = self.btnThumb.offset();
                    if (!self.vertical) {
                        if (self.areaClickOffset.x >= thumbOffset.left) {
                            canSetPosition = false;
                        }
                    }
                    else {
                        if (self.areaClickOffset.y >= thumbOffset.top) {
                            canSetPosition = false;
                        }
                    }

                    if (canSetPosition) {
                        self.setPosition(self.value - step);
                    }
                    return false;
                }
            });
            this.addHandler(this.areaDown, eventName, function (event) {
                if (!self.disabled) {
                    var step = self.largestep;
                    if (self.rtl && !self.vertical) {
                        step = -self.largestep;
                    }

                    var canSetPosition = true;
                    var thumbOffset = self.btnThumb.offset();
                    if (!self.vertical) {
                        if (self.areaClickOffset.x <= thumbOffset.left) {
                            canSetPosition = false;
                        }
                    }
                    else {
                        if (self.areaClickOffset.y <= thumbOffset.top) {
                            canSetPosition = false;
                        }
                    }

                    if (canSetPosition) {
                        self.setPosition(self.value + step);
                    }
                    return false;
                }
            });
            this.addHandler(this.areaUp, 'mousedown', function (event) {
                if (!self.disabled) {
                    self.areaUpCapture = true;
                    self.areaClickOffset = { x: event.pageX, y: event.pageY };
                    return false;
                }
            });
            this.addHandler(this.areaDown, 'mousedown', function (event) {
                if (!self.disabled) {
                    self.areaDownCapture = true;
                    self.areaClickOffset = { x: event.pageX, y: event.pageY };
                    return false;
                }
            });

            this.addHandler(this.btnThumb, 'mousedown dragstart', function (event) {
                if (event.type === "dragstart")
                    return false;

                if (!self.disabled) {
                    self.handlemousedown(event);
                }
                if (event.preventDefault) {
                    event.preventDefault();
                }
            });

            this.addHandler($(document), 'mouseup.' + this.element.id, function (event) {
                if (!self.disabled) self.handlemouseup(self, event);
            });

            if (!this.isTouchDevice) {
                this.mousemoveFunc = function (event) {
                    if (!self.disabled) {
                        self.handlemousemove(event);
                    }
                }

                this.addHandler($(document), 'mousemove.' + this.element.id, this.mousemoveFunc);
                this.addHandler($(document), 'mouseleave.' + this.element.id, function (event) { if (!self.disabled) self.handlemouseleave(event); });
                this.addHandler($(document), 'mouseenter.' + this.element.id, function (event) { if (!self.disabled) self.handlemouseenter(event); });

                if (!self.disabled) {
                    this.addHandler(this.btnUp, 'mouseenter mouseleave', function (event) {
                        if (event.type === "mouseenter") {
                            if (!self.disabled && !self.btnUpInstance.base.disabled && self.touchMode != true) {
                                self.btnUp.addClass(self.toThemeProperty('jqx-scrollbar-button-state-hover'));
                                self.btnUp.addClass(self.toThemeProperty('jqx-fill-state-hover'));
                                self._addArrowClasses('hover', 'up');
                            }
                        }
                        else {
                            if (!self.disabled && !self.btnUpInstance.base.disabled && self.touchMode != true) {
                                self.btnUp.removeClass(self.toThemeProperty('jqx-scrollbar-button-state-hover'));
                                self.btnUp.removeClass(self.toThemeProperty('jqx-fill-state-hover'));
                                self._removeArrowClasses('hover', 'up');
                            }
                        }
                    });

                    var thumbHoverClass = self.toThemeProperty('jqx-scrollbar-thumb-state-hover');
                    if (!self.vertical) {
                        thumbHoverClass = self.toThemeProperty('jqx-scrollbar-thumb-state-hover-horizontal');
                    }

                    this.addHandler(this.btnThumb, 'mouseenter mouseleave', function (event) {
                        if (event.type === "mouseenter") {
                            if (!self.disabled && self.touchMode != true) {
                                self.btnThumb.addClass(thumbHoverClass);
                                self.btnThumb.addClass(self.toThemeProperty('jqx-fill-state-hover'));
                            }
                        }
                        else {
                            if (!self.disabled && self.touchMode != true) {
                                self.btnThumb.removeClass(thumbHoverClass);
                                self.btnThumb.removeClass(self.toThemeProperty('jqx-fill-state-hover'));
                            }
                        }
                    });

                    this.addHandler(this.btnDown, 'mouseenter mouseleave', function (event) {
                        if (event.type === "mouseenter") {
                            if (!self.disabled && !self.btnDownInstance.base.disabled && self.touchMode != true) {
                                self.btnDown.addClass(self.toThemeProperty('jqx-scrollbar-button-state-hover'));
                                self.btnDown.addClass(self.toThemeProperty('jqx-fill-state-hover'));
                                self._addArrowClasses('hover', 'down');
                            }
                        }
                        else {
                            if (!self.disabled && !self.btnDownInstance.base.disabled && self.touchMode != true) {
                                self.btnDown.removeClass(self.toThemeProperty('jqx-scrollbar-button-state-hover'));
                                self.btnDown.removeClass(self.toThemeProperty('jqx-fill-state-hover'));
                                self._removeArrowClasses('hover', 'down');
                            }
                        }
                    });
                }
            }
        },

        destroy: function () {
            var btnUp = this.btnUp;
            var btnDown = this.btnDown;
            var btnThumb = this.btnThumb;
            var elWrap = this.scrollWrap;
            var areaUp = this.areaUp;
            var areaDown = this.areaDown;

            this.arrowUp.remove();
            delete this.arrowUp;
            this.arrowDown.remove();
            delete this.arrowDown;

            areaDown.removeClass();
            areaUp.removeClass();
            btnDown.removeClass();
            btnUp.removeClass();
            btnThumb.removeClass();

            btnUp.jqxRepeatButton('destroy');
            btnDown.jqxRepeatButton('destroy');
            areaUp.jqxRepeatButton('destroy');
            areaDown.jqxRepeatButton('destroy');
            btnThumb.jqxButton('destroy');
            var vars = $.data(this.element, "jqxScrollBar");

            this._removeHandlers();
            this.btnUp = null;
            this.btnDown = null;
            this.scrollWrap = null;
            this.areaUp = null;
            this.areaDown = null;
            this.scrollOuterWrap = null;
            delete this.mousemoveFunc;
            delete this.btnDownInstance;
            delete this.btnUpInstance;
            delete this.scrollOuterWrap;
            delete this.scrollWrap;
            delete this.btnDown;
            delete this.areaDown;
            delete this.areaUp;
            delete this.btnDown;
            delete this.btnUp;
            delete this.btnThumb;
            delete this.propertyChangeMap['value'];
            delete this.propertyChangeMap['min'];
            delete this.propertyChangeMap['max'];
            delete this.propertyChangeMap['touchMode'];
            delete this.propertyChangeMap['disabled'];
            delete this.propertyChangeMap['theme'];
            delete this.propertyChangeMap;
            if (vars) {
                delete vars.instance;
            }
            this.host.removeData();
            this.host.remove();
            delete this.host;
            delete this.set;
            delete this.get;
            delete this.call;
            delete this.element;
        },

        _removeHandlers: function () {
            this.removeHandler(this.btnUp, 'mouseenter');
            this.removeHandler(this.btnDown, 'mouseenter');
            this.removeHandler(this.btnThumb, 'mouseenter');
            this.removeHandler(this.btnUp, 'mouseleave');
            this.removeHandler(this.btnDown, 'mouseleave');
            this.removeHandler(this.btnThumb, 'mouseleave');
            this.removeHandler(this.btnUp, 'click');
            this.removeHandler(this.btnDown, 'click');
            this.removeHandler(this.btnDown, 'mouseup');
            this.removeHandler(this.btnUp, 'mouseup');
            this.removeHandler(this.btnDown, 'mousedown');
            this.removeHandler(this.btnUp, 'mousedown');
            this.removeHandler(this.areaUp, 'mousedown');
            this.removeHandler(this.areaDown, 'mousedown');
            this.removeHandler(this.areaUp, 'click');
            this.removeHandler(this.areaDown, 'click');
            this.removeHandler(this.btnThumb, 'mousedown');
            this.removeHandler(this.btnThumb, 'dragstart');
            this.removeHandler($(document), 'mouseup.' + this.element.id);
            if (!this.mousemoveFunc) {
                this.removeHandler($(document), 'mousemove.' + this.element.id);
            }
            else {
                this.removeHandler($(document), 'mousemove.' + this.element.id, this.mousemoveFunc);
            }

            this.removeHandler($(document), 'mouseleave.' + this.element.id);
            this.removeHandler($(document), 'mouseenter.' + this.element.id);
            var self = this;
        },

        _addArrowClasses: function (state, button) {
            if (state == 'pressed') state = 'selected';
            if (state != '') {
                state = '-' + state;
            }

            if (this.vertical) {
                if (button == 'up' || button == undefined) {
                    this.arrowUp.addClass(this.toThemeProperty("jqx-icon-arrow-up" + state));
                }

                if (button == 'down' || button == undefined) {
                    this.arrowDown.addClass(this.toThemeProperty("jqx-icon-arrow-down" + state));
                }
            }
            else {
                if (button == 'up' || button == undefined) {
                    this.arrowUp.addClass(this.toThemeProperty("jqx-icon-arrow-left" + state));
                }

                if (button == 'down' || button == undefined) {
                    this.arrowDown.addClass(this.toThemeProperty("jqx-icon-arrow-right" + state));
                }
            }
        },

        _removeArrowClasses: function (state, button) {
            if (state == 'pressed') state = 'selected';
            if (state != '') {
                state = '-' + state;
            }

            if (this.vertical) {
                if (button == 'up' || button == undefined) {
                    this.arrowUp.removeClass(this.toThemeProperty("jqx-icon-arrow-up" + state));
                }

                if (button == 'down' || button == undefined) {
                    this.arrowDown.removeClass(this.toThemeProperty("jqx-icon-arrow-down" + state));
                }
            }
            else {
                if (button == 'up' || button == undefined) {
                    this.arrowUp.removeClass(this.toThemeProperty("jqx-icon-arrow-left" + state));
                }

                if (button == 'down' || button == undefined) {
                    this.arrowDown.removeClass(this.toThemeProperty("jqx-icon-arrow-right" + state));
                }
            }
        },

        setTheme: function () {
            var btnUp = this.btnUp;
            var btnDown = this.btnDown;
            var btnThumb = this.btnThumb;
            var elWrap = this.scrollWrap;
            var areaUp = this.areaUp;
            var areaDown = this.areaDown;
            var arrowUp = this.arrowUp;
            var arrowDown = this.arrowDown;

            this.scrollWrap[0].className = this.toThemeProperty('jqx-reset');
            this.scrollOuterWrap[0].className = this.toThemeProperty('jqx-reset');

            var areaClassName = this.toThemeProperty('jqx-reset');
            this.areaDown[0].className = areaClassName;
            this.areaUp[0].className = areaClassName;

            var hostClass = this.toThemeProperty('jqx-scrollbar') + " " + this.toThemeProperty('jqx-widget') + " " + this.toThemeProperty('jqx-widget-content');
            this.host.addClass(hostClass);
            if (this.isTouchDevice) {
                this.host.addClass(this.toThemeProperty('jqx-scrollbar-mobile'));
            }

            btnDown[0].className = this.toThemeProperty('jqx-scrollbar-button-state-normal');
            btnUp[0].className = this.toThemeProperty('jqx-scrollbar-button-state-normal');

            var thumbClass = "";
            if (this.vertical) {
                arrowUp[0].className = areaClassName + " " + this.toThemeProperty("jqx-icon-arrow-up");
                arrowDown[0].className = areaClassName + " " + this.toThemeProperty("jqx-icon-arrow-down");
                thumbClass = this.toThemeProperty('jqx-scrollbar-thumb-state-normal');
            }
            else {
                arrowUp[0].className = areaClassName + " " + this.toThemeProperty("jqx-icon-arrow-left");
                arrowDown[0].className = areaClassName + " " + this.toThemeProperty("jqx-icon-arrow-right");
                thumbClass = this.toThemeProperty('jqx-scrollbar-thumb-state-normal-horizontal');
            }
            thumbClass += " " + this.toThemeProperty('jqx-fill-state-normal');

            btnThumb[0].className = thumbClass;

            if (this.disabled) {
                elWrap.addClass(this.toThemeProperty('jqx-fill-state-disabled'));
                elWrap.removeClass(this.toThemeProperty('jqx-scrollbar-state-normal'));
            }
            else {
                elWrap.addClass(this.toThemeProperty('jqx-scrollbar-state-normal'));
                elWrap.removeClass(this.toThemeProperty('jqx-fill-state-disabled'));
            }

            if (this.roundedCorners == 'all') {
                this.host.addClass(this.toThemeProperty('jqx-rc-all'));
                if (this.vertical) {
                    var rct = $.jqx.cssroundedcorners('top');
                    rct = this.toThemeProperty(rct);
                    btnUp.addClass(rct);

                    var rcb = $.jqx.cssroundedcorners('bottom');
                    rcb = this.toThemeProperty(rcb);
                    btnDown.addClass(rcb);

                }
                else {
                    var rcl = $.jqx.cssroundedcorners('left');
                    rcl = this.toThemeProperty(rcl);
                    btnUp.addClass(rcl);

                    var rcr = $.jqx.cssroundedcorners('right');
                    rcr = this.toThemeProperty(rcr);
                    btnDown.addClass(rcr);
                }
            }
            else {
                var rc = $.jqx.cssroundedcorners(this.roundedCorners);
                rc = this.toThemeProperty(rc);
                btnUp.addClass(rc);
                btnDown.addClass(rc);
            }

            var rc = $.jqx.cssroundedcorners(this.roundedCorners);
            rc = this.toThemeProperty(rc);
            if (!btnThumb.hasClass(rc)) {
                btnThumb.addClass(rc);
            }
            if (btnUp.css('display') === 'none') {
                this.showButtons = false;
                this.touchModeStyle = true;
                btnThumb.addClass(this.toThemeProperty('jqx-scrollbar-thumb-state-normal-touch'));
            }

            if (this.isTouchDevice && this.touchModeStyle != false) {
                this.showButtons = false;
                btnThumb.addClass(this.toThemeProperty('jqx-scrollbar-thumb-state-normal-touch'));
            }
        },

        // returns true, if the user is dragging the thumb or the increase or decrease button is pressed.
        isScrolling: function () {
            if (this.thumbCapture == undefined || this.buttonDownCapture == undefined || this.buttonUpCapture == undefined || this.areaDownCapture == undefined || this.areaUpCapture == undefined)
                return false;

            return this.thumbCapture || this.buttonDownCapture || this.buttonUpCapture || this.areaDownCapture || this.areaUpCapture;
        },

        track: function () {
            var now, elapsed, delta, v;

            now = Date.now();
            elapsed = now - this.timestamp;
            this.timestamp = now;
            delta = this.offset - this.frame;
            this.frame = this.offset;
            v = 1000 * delta / (1 + elapsed);
            this.velocity = 0.2 * v + 0.2 * this.velocity;
        },

        handlemousedown: function (event) {
            if (this.thumbCapture == undefined || this.thumbCapture == false) {
                this.thumbCapture = true;
                var btnThumb = this.btnThumb;
                if (btnThumb != null) {
                    btnThumb.addClass(this.toThemeProperty('jqx-fill-state-pressed'));
                    if (this.vertical) {
                        btnThumb.addClass(this.toThemeProperty('jqx-scrollbar-thumb-state-pressed'));
                    }
                    else {
                        btnThumb.addClass(this.toThemeProperty('jqx-scrollbar-thumb-state-pressed-horizontal'));
                    }
                    this.element.setAttribute('touched', '');
                }
            }

            var that = this;
            function tap(e) {
                that.reference = parseInt(that.btnThumb[0].style.top);
                that.offset = parseInt(that.btnThumb[0].style.top);
                if (!that.vertical) {
                    that.reference = parseInt(that.btnThumb[0].style.left);
                    that.offset = parseInt(that.btnThumb[0].style.left);
                }

                that.velocity = that.amplitude = 0;
                that.frame = that.offset;
                that.timestamp = Date.now();
                clearInterval(that.ticker);
                that.ticker = setInterval(function () {
                    that.track();
                }, 100);
            }
            if (this.thumbCapture && $.jqx.scrollAnimation) {
                tap(event);
            }
            this.dragStartX = event.clientX;
            this.dragStartY = event.clientY;
            this.dragStartValue = this.value;
        },

        toggleHover: function (event, element) {
            //element.toggleClass('jqx-fill-state-hover');
        },

        refresh: function () {
            this._arrange();
        },

        _setElementPosition: function (element, x, y) {
            if (!isNaN(x)) {
                if (parseInt(element[0].style.left) != parseInt(x)) {
                    element[0].style.left = x + 'px';
                }
            }
            if (!isNaN(y)) {
                if (parseInt(element[0].style.top) != parseInt(y)) {
                    element[0].style.top = y + 'px';
                }
            }
        },

        _setElementTopPosition: function (element, y) {
            if (!isNaN(y)) {
                element[0].style.top = y + 'px';
            }
        },

        _setElementLeftPosition: function (element, x) {
            if (!isNaN(x)) {
                element[0].style.left = x + 'px';
            }
        },

        handlemouseleave: function (event) {
            var btnUp = this.btnUp;
            var btnDown = this.btnDown;

            if (this.buttonDownCapture || this.buttonUpCapture) {
                btnUp.removeClass(this.toThemeProperty('jqx-scrollbar-button-state-pressed'));
                btnDown.removeClass(this.toThemeProperty('jqx-scrollbar-button-state-pressed'));
                this._removeArrowClasses('pressed');
            }

            if (this.thumbCapture != true)
                return;

            var btnThumb = this.btnThumb;
            var btnThumbPressedClass = this.vertical ? this.toThemeProperty('jqx-scrollbar-thumb-state-pressed') : this.toThemeProperty('jqx-scrollbar-thumb-state-pressed-horizontal');
            btnThumb.removeClass(btnThumbPressedClass);
            btnThumb.removeClass(this.toThemeProperty('jqx-fill-state-pressed'));
            this.element.removeAttribute('touched');
        },

        handlemouseenter: function (event) {
            var btnUp = this.btnUp;
            var btnDown = this.btnDown;

            if (this.buttonUpCapture) {
                btnUp.addClass(this.toThemeProperty('jqx-scrollbar-button-state-pressed'));
                btnUp.addClass(this.toThemeProperty('jqx-fill-state-pressed'));
                this._addArrowClasses('pressed', 'up');
                this.element.setAttribute('touched', '');
            }

            if (this.buttonDownCapture) {
                btnDown.addClass(this.toThemeProperty('jqx-scrollbar-button-state-pressed'));
                btnDown.addClass(this.toThemeProperty('jqx-fill-state-pressed'));
                this._addArrowClasses('pressed', 'down');
                this.element.setAttribute('touched', '');
            }

            if (this.thumbCapture != true)
                return;

            var btnThumb = this.btnThumb;
            if (this.vertical) {
                btnThumb.addClass(this.toThemeProperty('jqx-scrollbar-thumb-state-pressed'));
            }
            else {
                btnThumb.addClass(this.toThemeProperty('jqx-scrollbar-thumb-state-pressed-horizontal'));
            }
            btnThumb.addClass(this.toThemeProperty('jqx-fill-state-pressed'));
            this.element.setAttribute('touched', '');
        },

        handlemousemove: function (event) {
            var btnUp = this.btnUp;
            var btnDown = this.btnDown;
            var which = 0;

            if (btnDown == null || btnUp == null)
                return;

            if (btnUp != null && btnDown != null && this.buttonDownCapture != undefined && this.buttonUpCapture != undefined) {
                if (this.buttonDownCapture && event.which == which) {
                    btnDown.removeClass(this.toThemeProperty('jqx-scrollbar-button-state-pressed'));
                    btnDown.removeClass(this.toThemeProperty('jqx-fill-state-pressed'));
                    this._removeArrowClasses('pressed', 'down');

                    this.buttonDownCapture = false;
                }
                else if (this.buttonUpCapture && event.which == which) {
                    btnUp.removeClass(this.toThemeProperty('jqx-scrollbar-button-state-pressed'));
                    btnUp.removeClass(this.toThemeProperty('jqx-fill-state-pressed'));
                    this._removeArrowClasses('pressed', 'up');
                    this.buttonUpCapture = false;
                }
            }

            if (this.thumbCapture != true)
                return false;

            var btnThumb = this.btnThumb;

            if (event.which == which && !this.isTouchDevice && !this._touchSupport) {
                this.thumbCapture = false;
                this._arrange();
                var btnThumbPressedClass = this.vertical ? this.toThemeProperty('jqx-scrollbar-thumb-state-pressed') : this.toThemeProperty('jqx-scrollbar-thumb-state-pressed-horizontal');
                btnThumb.removeClass(btnThumbPressedClass);
                btnThumb.removeClass(this.toThemeProperty('jqx-fill-state-pressed'));
                return true;
            }

            if (event.preventDefault != undefined) {
                event.preventDefault();
            }

            if (event.originalEvent != null) {
                event.originalEvent.mouseHandled = true;
            }

            if (event.stopPropagation != undefined) {
                event.stopPropagation();
            }

            var diff = 0;

            try {
                if (!this.vertical) {
                    diff = event.clientX - this.dragStartX;
                }
                else {
                    diff = event.clientY - this.dragStartY;
                }

                var btnAndThumbSize = this._btnAndThumbSize;
                if (!this._btnAndThumbSize) {
                    btnAndThumbSize = (this.vertical) ?
                        btnUp.height() + btnDown.height() + btnThumb.height() :
                        btnUp.width() + btnDown.width() + btnThumb.width();
                }

                var ratio = (this.max - this.min) / (this.scrollBarSize - btnAndThumbSize);
                if (this.thumbStep == 'auto') {
                    diff *= ratio;
                }
                else {
                    diff *= ratio;
                    if (Math.abs(this.dragStartValue + diff - this.value) >= parseInt(this.thumbStep)) {
                        var step = Math.round(parseInt(diff) / this.thumbStep) * this.thumbStep;
                        if (this.rtl && !this.vertical) {
                            this.setPosition(this.dragStartValue - step);
                        }
                        else {
                            this.setPosition(this.dragStartValue + step);
                        }
                        return false;
                    }
                    else {
                        return false;
                    }
                }

                var step = diff;
                if (this.rtl && !this.vertical) {
                    step = -diff;
                }

                this.setPosition(this.dragStartValue + step);
                this.offset = parseInt(btnThumb[0].style.left);
                if (this.vertical) {
                    this.offset = parseInt(btnThumb[0].style.top);
                }
            }
            catch (error) {
                alert(error);
            }

            return false;
        },

        handlemouseup: function (self, event) {
            var prevent = false;

            if (this.thumbCapture) {
                this.thumbCapture = false;

                var btnThumb = this.btnThumb;
                var btnThumbPressedClass = this.vertical ? this.toThemeProperty('jqx-scrollbar-thumb-state-pressed') : this.toThemeProperty('jqx-scrollbar-thumb-state-pressed-horizontal');
                btnThumb.removeClass(btnThumbPressedClass);
                btnThumb.removeClass(this.toThemeProperty('jqx-fill-state-pressed'));
                this.element.removeAttribute('touched');

                prevent = true;
                this._mouseup = new Date();
                if ($.jqx.scrollAnimation) {
                    var that = this;
                    function autoScroll() {
                        var elapsed, delta;
                        if (that.amplitude) {
                            elapsed = Date.now() - that.timestamp;
                            delta = -that.amplitude * Math.exp(-elapsed / 325);
                            if (delta > 0.5 || delta < -0.5) {
                                var ratio = (that.max - that.min) / (that.scrollBarSize - that._btnAndThumbSize);
                                var newValue = ratio * (that.target + delta)
                                var step = newValue;
                                if (that.rtl && !that.vertical) {
                                    step = -newValue;
                                }

                                that.setPosition(that.dragStartValue + step);
                                requestAnimationFrame(autoScroll);
                            } else {
                                var ratio = (that.max - that.min) / (that.scrollBarSize - that._btnAndThumbSize);
                                var newValue = ratio * (that.target + delta)
                                var step = newValue;
                                if (that.rtl && !that.vertical) {
                                    step = -newValue;
                                }

                                that.setPosition(that.dragStartValue + step);
                            }
                        }
                    }
                    clearInterval(this.ticker);
                    if (this.velocity > 25 || this.velocity < -25) {
                        this.amplitude = 0.8 * this.velocity;
                        this.target = Math.round(this.offset + this.amplitude);
                        if (!this.vertical) {
                            this.target -= this.reference;
                        }
                        else {
                            this.target -= this.reference;
                        }

                        this.timestamp = Date.now();
                        requestAnimationFrame(autoScroll);
                    }
                }
            }

            this.areaDownCapture = this.areaUpCapture = false;
            if (this.buttonUpCapture || this.buttonDownCapture) {
                var btnUp = this.btnUp;
                var btnDown = this.btnDown;

                this.buttonUpCapture = false;
                this.buttonDownCapture = false;
                btnUp.removeClass(this.toThemeProperty('jqx-scrollbar-button-state-pressed'));
                btnDown.removeClass(this.toThemeProperty('jqx-scrollbar-button-state-pressed'));
                btnUp.removeClass(this.toThemeProperty('jqx-fill-state-pressed'));
                btnDown.removeClass(this.toThemeProperty('jqx-fill-state-pressed'));
                this._removeArrowClasses('pressed');
                this.element.removeAttribute('touched');

                prevent = true;
                this._mouseup = new Date();
            }

            if (prevent) {
                if (event.preventDefault != undefined) {
                    event.preventDefault();
                }

                if (event.originalEvent != null) {
                    event.originalEvent.mouseHandled = true;
                }

                if (event.stopPropagation != undefined) {
                    event.stopPropagation();
                }
            }
        },

        // sets the value.
        // @param Number. Sets the ScrollBar's value.
        setPosition: function (position, update) {
            var element = this.element;

            if (position == undefined || position == NaN)
                position = this.min;

            if (position >= this.max) {
                position = this.max;
            }

            if (position < this.min) {
                position = this.min;
            }

            if (this.value !== position || update == true) {
                if (position == this.max) {
                    var completeEvent = new $.Event('complete');
                    this.host.trigger(completeEvent);
                }
                var oldvalue = this.value;
                if (this._triggervaluechanged) {
                    var event = new $.Event('valueChanged');
                    event.previousValue = this.value;
                    event.currentValue = position;
                }

                this.value = position;
                this._positionelements();
                //this._arrange();

                if (this._triggervaluechanged) {
                    this.host.trigger(event);
                }

                if (this.valueChanged) {
                    this.valueChanged({ currentValue: this.value, previousvalue: oldvalue });
                }
            }

            return position;
        },

        val: function (value) {
            var isEmpty = function (obj) {
                for (var key in obj) {
                    if (obj.hasOwnProperty(key))
                        return false;
                }
                if (typeof value == "number")
                    return false;
                if (typeof value == "date")
                    return false;
                if (typeof value == "boolean")
                    return false;
                if (typeof value == "string")
                    return false;

                return true;
            }
            if (isEmpty(value) || arguments.length == 0) {
                return this.value;
            }
            else {
                this.setPosition(value);
                return value;
            }
        },

        _getThumbSize: function (scrollAreaSize) {
            var positions = this.max - this.min;

            var size = 0;
            if (positions > 1) {
                size = (scrollAreaSize / (positions + scrollAreaSize) * scrollAreaSize);
            }
            else if (positions == 1) {
                size = scrollAreaSize - 1;
            }
            else if (positions == 0)
                size = scrollAreaSize;

            if (this.thumbSize > 0) {
                size = this.thumbSize;
            }

            if (size < this.thumbMinSize)
                size = this.thumbMinSize;

            return Math.min(size, scrollAreaSize);
        },

        _positionelements: function () {
            var element = this.element;
            var elAreaUp = this.areaUp;
            var elAreaDown = this.areaDown;
            var elBtnUp = this.btnUp;
            var elBtnDown = this.btnDown;
            var elThumb = this.btnThumb;
            var elWrap = this.scrollWrap;

            var height = this._height ? this._height : this.host.height();
            var width = this._width ? this._width : this.host.width();

            var btnSize = (!this.vertical) ? height : width;
            if (!this.showButtons) {
                btnSize = 0;
            }

            var scrollBarSize = (!this.vertical) ? width : height;
            this.scrollBarSize = scrollBarSize;
            var thumbSize = this._getThumbSize(scrollBarSize - 2 * btnSize);
            thumbSize = Math.floor(thumbSize);

            if (thumbSize < this.thumbMinSize)
                thumbSize = this.thumbMinSize;

            if (height == NaN || height < 10)
                height = 10;

            if (width == NaN || width < 10)
                width = 10;

            btnSize += 2;
            this.btnSize = btnSize;

            var btnAndThumbSize = this._btnAndThumbSize;

            if (!this._btnAndThumbSize) {
                var btnAndThumbSize = (this.vertical) ?
                    2 * this.btnSize + elThumb.outerHeight() :
                    2 * this.btnSize + elThumb.outerWidth();

                btnAndThumbSize = Math.round(btnAndThumbSize);
            }

            var upAreaSize = (scrollBarSize - btnAndThumbSize) / (this.max - this.min) * (this.value - this.min);
            if (this.rtl && !this.vertical) {
                upAreaSize = (scrollBarSize - btnAndThumbSize) / (this.max - this.min) * (this.max - this.value - this.min);
            }

            upAreaSize = Math.round(upAreaSize);
            if (upAreaSize < 0) {
                upAreaSize = 0;
            }
            if (this.vertical) {
                var newDownSize = scrollBarSize - upAreaSize - btnAndThumbSize;
                if (newDownSize < 0) newDownSize = 0;
                elAreaDown[0].style.height = newDownSize + 'px';
                elAreaUp[0].style.height = upAreaSize + 'px';

                this._setElementTopPosition(elAreaUp, btnSize);
                this._setElementTopPosition(elThumb, btnSize + upAreaSize);
                this._setElementTopPosition(elAreaDown, btnSize + upAreaSize + thumbSize);
            }
            else {
                elAreaUp[0].style.width = upAreaSize + 'px';
                if (scrollBarSize - upAreaSize - btnAndThumbSize >= 0) {
                    elAreaDown[0].style.width = scrollBarSize - upAreaSize - btnAndThumbSize + 'px';
                }
                else {
                    elAreaDown[0].style.width = '0px';
                }

                this._setElementLeftPosition(elAreaUp, btnSize);
                this._setElementLeftPosition(elThumb, btnSize + upAreaSize);
                this._setElementLeftPosition(elAreaDown, 2 + btnSize + upAreaSize + thumbSize);
            }
        },

        _arrange: function () {
            var self = this;
            if (self._initialLayout) {
                self._initialLayout = false;
                return;
            }

            if (self.min > self.max) {
                var tmp = self.min;
                self.min = self.max;
                self.max = tmp;
            }

            if (self.min < 0) {
                var diff = self.max - self.min;
                self.min = 0;
                self.max = diff;
            }

            var element = self.element;
            var elAreaUp = self.areaUp;
            var elAreaDown = self.areaDown;
            var elBtnUp = self.btnUp;
            var elBtnDown = self.btnDown;
            var elThumb = self.btnThumb;
            var elWrap = self.scrollWrap;

            var height = parseInt(self.element.style.height);
            var width = parseInt(self.element.style.width);
            if (self.isPercentage) {
                var height = self.host.height();
                var width = self.host.width();
            }

            if (isNaN(height)) height = 0;
            if (isNaN(width)) width = 0;

            self._width = width;
            self._height = height;
            var btnSize = (!self.vertical) ? height : width;
            if (!self.showButtons) {
                btnSize = 0;
            }

            elBtnUp[0].style.width = btnSize + 'px';
            elBtnUp[0].style.height = btnSize + 'px';
            elBtnDown[0].style.width = btnSize + 'px';
            elBtnDown[0].style.height = btnSize + 'px';

            if (self.vertical) {
                elWrap[0].style.width = width + 2 + 'px';
            }
            else {
                elWrap[0].style.height = height + 2 + 'px';
            }

            // position the up button
            self._setElementPosition(elBtnUp, 0, 0);

            var btnSizeAndBorder = btnSize + 2;

            // position the down button
            if (self.vertical) {
                self._setElementPosition(elBtnDown, 0, height - btnSizeAndBorder);
            }
            else {
                self._setElementPosition(elBtnDown, width - btnSizeAndBorder, 0);
            }

            var scrollBarSize = (!self.vertical) ? width : height;
            self.scrollBarSize = scrollBarSize;
            var thumbSize = self._getThumbSize(scrollBarSize - 2 * btnSizeAndBorder);
            thumbSize = Math.floor(thumbSize - 2);

            if (thumbSize < self.thumbMinSize)
                thumbSize = self.thumbMinSize;

            var touchStyle = false;
            if (self.isTouchDevice && self.touchModeStyle != false) {
                touchStyle = true;
            }

            if (!self.vertical) {
                elThumb[0].style.width = thumbSize + 'px';
                elThumb[0].style.height = height + 'px';
                if (touchStyle && self.thumbTouchSize !== 0) {
                    elThumb.css({ height: self.thumbTouchSize + 'px' });
                    elThumb.css('margin-top', (self.host.height() - self.thumbTouchSize) / 2);
                }
            }
            else {
                elThumb[0].style.width = width + 'px';
                elThumb[0].style.height = thumbSize + 'px';

                if (touchStyle && self.thumbTouchSize !== 0) {
                    elThumb.css({ width: self.thumbTouchSize + 'px' });
                    elThumb.css('margin-left', (self.host.width() - self.thumbTouchSize) / 2);
                }
            }

            if (height == NaN || height < 10)
                height = 10;

            if (width == NaN || width < 10)
                width = 10;

            //btnSize += 2;
            self.btnSize = btnSize;

            var btnAndThumbSize = (self.vertical) ?
                2 * btnSizeAndBorder + (2 + parseInt(elThumb[0].style.height)) :
                2 * btnSizeAndBorder + (2 + parseInt(elThumb[0].style.width));

            btnAndThumbSize = Math.round(btnAndThumbSize);
            self._btnAndThumbSize = btnAndThumbSize;

            var upAreaSize = (scrollBarSize - btnAndThumbSize) / (self.max - self.min) * (self.value - self.min);
            if (self.rtl && !self.vertical)
                upAreaSize = (scrollBarSize - btnAndThumbSize) / (self.max - self.min) * (self.max - self.value - self.min);

            upAreaSize = Math.round(upAreaSize);

            if (isNaN(upAreaSize) || upAreaSize < 0 || upAreaSize === -Infinity || upAreaSize === Infinity)
                upAreaSize = 0;

            if (self.vertical) {
                var newAreaHeight = (scrollBarSize - upAreaSize - btnAndThumbSize);
                if (newAreaHeight < 0)
                    newAreaHeight = 0;

                elAreaDown[0].style.height = newAreaHeight + 'px';
                elAreaDown[0].style.width = width + 'px';
                elAreaUp[0].style.height = upAreaSize + 'px';
                elAreaUp[0].style.width = width + 'px';

                var hostHeight = parseInt(self.element.style.height);
                if (self.isPercentage)
                    hostHeight = self.host.height();

                elThumb[0].style.visibility = 'inherit';

                if (hostHeight - 3 * parseInt(btnSize) < 0 || hostHeight < btnAndThumbSize)
                    elThumb[0].style.visibility = 'hidden';

                self._setElementPosition(elAreaUp, 0, btnSizeAndBorder);
                self._setElementPosition(elThumb, 0, btnSizeAndBorder + upAreaSize);
                self._setElementPosition(elAreaDown, 0, btnSizeAndBorder + upAreaSize + thumbSize);
            }
            else {
                if (upAreaSize > 0) {
                    elAreaUp[0].style.width = upAreaSize + 'px';
                }
                if (height > 0) {
                    elAreaUp[0].style.height = height + 'px';
                }

                var newAreaWidth = (scrollBarSize - upAreaSize - btnAndThumbSize);
                if (newAreaWidth < 0)
                    newAreaWidth = 0;

                elAreaDown[0].style.width = newAreaWidth + 'px';
                elAreaDown[0].style.height = height + 'px';

                var hostWidth = parseInt(self.element.style.width);
                if (self.isPercentage)
                    hostWidth = self.host.width();

                elThumb[0].style.visibility = 'inherit';
                if ((hostWidth - 3 * parseInt(btnSize) < 0) || (hostWidth < btnAndThumbSize))
                    elThumb[0].style.visibility = 'hidden';

                self._setElementPosition(elAreaUp, btnSizeAndBorder, 0);
                self._setElementPosition(elThumb, btnSizeAndBorder + upAreaSize, 0);
                self._setElementPosition(elAreaDown, btnSizeAndBorder + upAreaSize + thumbSize, 0);
            }
        }
    }); // jqxScrollBar
})(jqxBaseFramework);
})();




/***/ }),

/***/ 9703:
/***/ (() => {

﻿/* tslint:disable */
/* eslint-disable */
(function(){
	if (typeof document === 'undefined') { 
		return;
	}

(function ($) {

    $.jqx.jqxWidget('jqxTagCloud', '', {});

    //noinspection JSUnusedGlobalSymbols
    $.extend($.jqx._jqxTagCloud.prototype, {

        defineInstance: function () {
            var settings = {
                //// properties
                width: null,
                height: null,
                // Type: Object
                // Default: null
                // data source.
                source: null,
                disabled: false, // possible values: true, false
                rtl: false, // possible values: true, false
                valueMember: 'value', // (string) sets the field name used for value/weight
                displayMember: 'label', // (string) sets the field name used for the tag label
                urlMember: 'url', // (string) sets the field name used by the anchor element
                urlBase: '', // (string) if set is used for common base URL path for all tags
                autoBind: true,  // (bool) auto binds to data adapter on widget creation
                takeTopWeightedItems: false, // (bool) indicates if displayLimit will prioritize highest value members
                displayLimit: null, // (int) filters highest values tags up to the number specified by the displayLimit
                minValueToDisplay: 0, // (int) filters tags with value lower than minValueToDisplay
                maxValueToDisplay: 0, // (int) filters tags with value higher than maxValueToDisplay
                minFontSize: 10, // (int) font size to be used for lowest value members
                maxFontSize: 24, // (int) font size to be used for highest value members
                fontSizeUnit: 'px', // possible values 'px', 'em', '%', ''
                displayValue: false, // possible values: true, false - whether to add the tag value field after the text
                sortBy: 'none', // possible values: 'none', 'label', 'value'
                alterTextCase: 'none', // possible values: 'none', 'allLower', 'allUpper', 'firstUpper', 'titleCase'
                sortOrder: 'ascending', // possible values: 'ascending', 'descending'
                textColor: null, // (#FFFFFF) possible values all colors with #
                minColor: null,  // (#FFFFFF) min and max colors if set would display the values in kind of gradient fashion between min and max
                maxColor: null,   // (#FFFFFF) min and max must both be set for this to work.
                tagRenderer: null  // callback function for custom tag rendering. Must return html string
            };
            if (this === $.jqx._jqxTagCloud.prototype) {
                return settings;
            }
            $.extend(true, this, settings);
            return settings;
        },

        createInstance: function () {
            var that = this;
            // renders the widget
            that.render();
            that.dataBind(that.source, true);
        },

        //// methods

        // public methods

        // Used to set the dataBinding to the adapter
        dataBind: function (source, initialRefresh) {
            var that = this;
            that.records = [];
            var isdataadapter = source._source ? true : false;
            var dataAdapter;

            if (isdataadapter) {
                dataAdapter = source;
                source = source._source;
            } else {
                source.datafields = [
                    { name: that.displayMember },
                    { name: that.valueMember },
                    { name: that.urlMember }
                ];
                dataAdapter = new $.jqx.dataAdapter(source,
                    {
                        autoBind: true
                    }
                );
            }

            var initAdapter = function () {
                if (source.type !== undefined) {
                    dataAdapter._options.type = source.type;
                }
                if (source.formatdata !== undefined) {
                    dataAdapter._options.formatData = source.formatdata;
                }
                if (source.contenttype !== undefined) {
                    dataAdapter._options.contentType = source.contenttype;
                }
                if (source.async !== undefined) {
                    dataAdapter._options.async = source.async;
                }
            };

            var updateFromAdapter = function (me) {
                me._setSourceData(dataAdapter);
                me._raiseEvent(1, { records: me.records});
                me._renderTags();
            };

            initAdapter(this);

            switch (source.datatype) {
                case 'local':
                case 'array':
                default:
                    if (source.localdata != null || $.isArray(source)) {
                        dataAdapter.unbindBindingUpdate(that.element.id);
                        if (that.autoBind || (!that.autoBind && !initialRefresh)) {
                            dataAdapter.dataBind();
                        }
                        updateFromAdapter(that);
                        dataAdapter.bindBindingUpdate(that.element.id, function (updateType) {
                            updateFromAdapter(that, updateType);
                        });
                    }
                    break;
                case 'json':
                case 'jsonp':
                case 'xml':
                case 'xhtml':
                case 'script':
                case 'text':
                case 'csv':
                case 'tab':
                {
                    if (source.localdata != null) {
                        dataAdapter.unbindBindingUpdate(that.element.id);
                        if (that.autoBind || (!that.autoBind && !initialRefresh)) {
                            dataAdapter.dataBind();
                        }
                        updateFromAdapter(that);
                        dataAdapter.bindBindingUpdate(that.element.id, function () {
                            updateFromAdapter(that);
                        });
                        return;
                    }

                    var postData = {};
                    if (dataAdapter._options.data) {
                        $.extend(dataAdapter._options.data, postData);
                    }
                    else {
                        if (source.data) {
                            $.extend(postData, source.data);
                        }
                        dataAdapter._options.data = postData;
                    }
                    var updateFunc = function () {
                        updateFromAdapter(that);
                    };

                    dataAdapter.unbindDownloadComplete(that.element.id);
                    dataAdapter.bindDownloadComplete(that.element.id, updateFunc);


                    if (that.autoBind || (!that.autoBind && !initialRefresh)) {
                        dataAdapter.dataBind();
                    }
                }
            }
            that._raiseEvent(2, { records: that.records});

        },

        // destroy the widget
        destroy: function () {
            var that = this;
            that.removeHandler(that._el, 'keydown');
            that.removeHandler(that._el, 'click');
            that.host.empty();
            that.host.remove();
        },

        // used to find a tag index by label
        findTagIndex: function (displayMember) {
            var that = this;
            for (var i = 0; i< that.records.length; i++ ) {
                if (that.records[i][that.displayMember] === displayMember){
                    return that.records[i].index;
                }
            }
            return -1;
        },

        // returns an array with indices of hidden elements
        getHiddenTagsList: function (){
            return this.hiddenList.slice();
        },

        // returns a copy of array with all tags that have been rendered
        getRenderedTags: function (){
            return this.renderedData.slice();
        },

        // returns a copy of array with all tags, even those that get filtered
        getTagsList: function (){
            return this.records.slice();
        },

        // used to insert an element before an element with specified index
        insertAt: function (index, tagItem) {
            var that = this;
            tagItem.index = index;
            if (tagItem[this.displayMember] === undefined){
                throw new Error ('jqxTagCloud: Insert tag requires a valid displayMember field to be supplied in the parameter');
            }
            var val = tagItem[that.valueMember] !== undefined ? parseFloat(tagItem[that.valueMember]) : 0;
            tagItem[that.valueMember] = isNaN(val) ? 0 : val;

            if (that.source.insertTag && typeof(that.source.insertTag) === 'function'){
                that.source.insertTag(index, tagItem, function(commit){
                    if (commit){
                        that.records.splice(index, 0, tagItem);

                        for (var i = index + 1; i < that.records.length ; i++){
                            that.records[i].index += 1;
                        }
                        for (i = 0; i < that.hiddenList.length; i++){
                            if (that.hiddenList[i] >= index){
                                that.hiddenList[i]++;
                            }
                        }
                        that._renderTags();
                    }
                });
            } else {
                that.records.splice(index, 0, tagItem);

                for (var i = index + 1; i < that.records.length ; i++){
                    that.records[i].index += 1;
                }
                for (i = 0; i < that.hiddenList.length; i++){
                    if (that.hiddenList[i] >= index){
                        that.hiddenList[i]++;
                    }
                }
                that._renderTags();
            }
        },

        // used to update a specific element with specified index
        updateAt: function (index, tagItem) {
            var that = this;

            if (tagItem[this.displayMember] === undefined){
                throw new Error ('jqxTagCloud: Update tag requires a valid displayMember field to be supplied in the parameter');
            }

            tagItem.index = index;
            tagItem.uid = that.records[index].uid;
            if (that.source.updateTag && typeof(that.source.updateTag) === 'function'){
                that.source.updateTag(index, tagItem, function(commit){
                    if (commit){
                        $.each(tagItem, function (item, value){
                            that.records[index][item] = value;
                        });
                        that._renderTags();
                    }
                });
            } else {
                $.each(tagItem, function (item, value){
                    that.records[index][item] = value;
                });
                that._renderTags();
            }

        },

        // used to remove an element with specified index
        removeAt: function (index) {
            var that = this;
            if (that.source.deleteTag && typeof(that.source.deleteTag) === 'function'){
                that.source.deleteTag(index, function(commit){
                    if (commit){
                        that.records.splice(index, 1);
                        for (var i = index; i < that.records.length ; i++){
                            that.records[i].index -= 1;
                        }
                        for (i = 0; i < that.hiddenList.length; i++){
                            if (that.hiddenList[i] > index){
                                that.hiddenList[i]--;
                            } else if (that.hiddenList[i] === index){
                                that.hiddentList.splice(index,1);
                            }
                        }
                    }
                });
            } else {
                that.records.splice(index, 1);
                for (var i = index; i < that.records.length ; i++){
                    that.records[i].index -= 1;
                }
                for (i = 0; i < that.hiddenList.length; i++){
                    if (that.hiddenList[i] > index){
                        that.hiddenList[i]--;
                    } else if (that.hiddenList[i] === index){
                        that.hiddentList.splice(index,1);
                    }
                }
            }
            that._renderTags();
        },

        // used to hide the element with specified index
        hideItem: function (index) {
            var that = this;
            if (!(typeof(index) !== 'number' || that.hiddenList.indexOf(index) !== -1)) {
                that.hiddenList.push(index);
                var pos = -1;
                for (var i=0 ; i < that.renderedData.length; i++){
                    if (that.renderedData[i].index === index){
                        pos = i;
                    }
                }
                if ( pos !== -1) {
                    $(that._el).find('li')[pos].style.display = 'none';
                }
            }
        },

        // used to reveal the element with specified index
        showItem: function (index) {
            var that = this;
            if (that.hiddenList.indexOf(index) !== -1) {
                var pos = -1;
                for (var i=0 ; i < that.renderedData.length; i++){
                    if (that.renderedData[i].index === index){
                        pos = i;
                    }
                }
                if ( pos !== -1) {
                    $(that._el).find('li')[pos].style.display ='';
                }
                that.hiddenList.splice(that.hiddenList.indexOf(index), 1);
            }
        },

        // renders the widget
        render: function () {
            var that = this;
            that._updateSize();
            that.renderedData = [];
            that._el = $('<ul>');
            that.host.addClass(that.toThemeProperty('jqx-widget jqx-tag-cloud'));
            that._setRtl();
            that.host.append(that._el);
            that.focusedItem = null;
            that.minColor = that._parseColor(that.minColor);
            that.maxColor = that._parseColor(that.maxColor);
            that.displayLimit = parseInt(that.displayLimit);
            if (that.disabled) {
                that.host.addClass(that.toThemeProperty('jqx-fill-state-disabled'));
            }

            that.addHandler(that._el, 'click', function (event) {
                if ($(document.activeElement).parents('#' + that._el[0].parentElement.id).length) {
                    // do nothing
                } else {
                    if (that.focusedItem != null) {
                        $(that.focusedItem).focus();
                    } else {
                        $(that._el).find('a')[0].focus();
                        that.focusedItem = document.activeElement;
                    }
                }
                if (that.disabled){
                    event.preventDefault();
                }

                if(event.target.tagName.toLowerCase() === 'a'){
                    event.target.focus();
                    that.focusedItem = document.activeElement;
                }
                if(event.target.tagName.toLowerCase() === 'li'){
                    $(event.target).find('a').focus();
                    that.focusedItem = document.activeElement;
                }
                var index = $(event.target).closest('li').index();
                if (index !== -1){
                    that._raiseEvent(0, {
                        label: that.renderedData[index][that.displayMember],
                        url: that.renderedData[index][that.urlMember],
                        value: that.renderedData[index][that.valueMember],
                        visibleIndex: index,
                        index: that.renderedData[index].index,
                        target: $(event.target).closest('li')[0],
                        originalEvent: event
                    });
                }
            });



            that._addKeyboardSupport();
        },

        // resize the widget
        resize: function (width, height) {
            var that = this;
            that.width = width;
            that.height = height;
            that._updateSize();
        },

        // private methods

        // handles properties updates
        propertyChangedHandler: function (object, key, oldvalue, value) {
            var that = this;
            if (key === 'source') {
                that.dataBind(object.source);
            }

            if (key === 'displayLimit') {
                that[key] = parseInt(value);
            }
            if (key === 'minColor' || key === 'maxColor') {
                that[key] = that._parseColor(value);
            }
            if (key === 'rtl') {
                that._setRtl();
                return;
            }
            if (key === 'width' || key === 'height') {
                that._updateSize();
                return;
            }
            if (key === 'textColor'){
                if(!(that.minColor && that.maxColor)) {
                    that._updateColor();
                    return;
                }
            }
            that._renderTags();
        },

        // changes the letterCase of the displayMember field
        _alterCase: function (data) {
            var that = this;

            function toTitleCase(str) {
                return str.replace(/\w\S*/g, function (txt) {
                    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                });
            }

            if (that.alterTextCase !== 'none') {
                switch (that.alterTextCase) {
                    case 'allLower':
                        for (var i = 0; i < data.length; i++) {
                            data[i][that.displayMember] = data[i][that.displayMember].toString().toLowerCase();
                        }
                        break;
                    case 'allUpper':
                        for (i = 0; i < data.length; i++) {
                            data[i][that.displayMember] = data[i][that.displayMember].toString().toUpperCase();
                        }
                        break;
                    case 'firstUpper':
                        for (i = 0; i < data.length; i++) {
                            data[i][that.displayMember] = data[i][that.displayMember].toString().toLowerCase();
                            data[i][that.displayMember] = data[i][that.displayMember].substr(0, 1).toUpperCase() + data[i][that.displayMember].substr(1);
                        }
                        break;
                    case 'titleCase':
                        for (i = 0; i < data.length; i++) {
                            data[i][that.displayMember] = toTitleCase(data[i][that.displayMember].toString());
                        }
                        break;
                    default:
                        throw new Error("jqxTagCloud: Invalid alterTextCase value. Possible values: 'none', 'allLower', 'allUpper', 'firstUpper', 'titleCase'");
                }
            }

            return data;
        },

        _addKeyboardSupport: function () {
            var that = this;
            that.addHandler(that._el, 'keydown', function (event) {
                // Right Arrow Key
                if (event.keyCode == 39) {
                    $('a:focus').closest('li').next().find('a').focus();
                    that.focusedItem = document.activeElement;
                }

                // Left Arrow Key
                if (event.keyCode == 37) {
                    $('a:focus').closest('li').prev().find('a').focus();
                    that.focusedItem = document.activeElement;
                }
            });
        },

        _renderTags: function () {
            var that = this;
            var data = that.records.slice();
            $.each(that.records, function(index, value){
                if (value[that.displayMember] === undefined){
                    throw new Error("jqxTagCloud: 'label' property must be specified for every element.");
                }
            });

            data = that._filter(data);
            data = that._sort(data);
            data = that._alterCase(data);
            that._el.empty(); // clear content
            if (data.length === 0){
                return;
            }
            var maxValue = that._getMaxValue(data);
            var minValue = that._getMinValue(data);
            var valueRange = maxValue - minValue;
            for (var i = 0; i < data.length; i++) {

                var tagItem = that._prepareTag(data[i], minValue, valueRange);

                // append element to widget
                that._el.append(tagItem);
                if (that.hiddenList.indexOf(data[i].index) != -1) {
                    tagItem[0].style.display = 'none';
                }
            }
            that.renderedData = data;
            that.focusedItem = null;
        },

        _prepareTag: function (itemData, minValue, valueRange) {
            var that = this;

            if (!valueRange) {
                valueRange = 1;
            }

            var tagItem = $('<li>'); // create li element
            //add label to li element
            var html = '';
            if (null !== that.tagRenderer && typeof(that.tagRenderer) === 'function') {
                html = that.tagRenderer.apply(that, arguments);
            } else {
                html = itemData[that.displayMember] + (that.displayValue ? '(' + itemData[that.valueMember] + ')' : '' );
            }
            html = $('<a rel="tag">').append(html);
            var url = 'javascript:void(0)';
            if (undefined !== itemData[that.urlMember]) {
                url = (that.urlBase != null ? that.urlBase : '' ) + itemData[that.urlMember];
            }
            html.attr('href', url);

            tagItem.append(html);

            // add classes to li element
            tagItem.addClass(that.toThemeProperty('jqx-tag-cloud-item'));

            // set font size
            var fontSize = +that.minFontSize + ((that.maxFontSize - that.minFontSize) *
                ((itemData[that.valueMember] - minValue) / valueRange));
            tagItem[0].style.fontSize = fontSize + that.fontSizeUnit;

            // set font color gradient
            if (that.minColor && that.maxColor) {
                var c = that.minColor.split('(')[1].split(')')[0];
                c = c.split(',');
                var red = parseInt(c[0]);
                var green = parseInt(c[1]);
                var blue = parseInt(c[2]);
                var alpha = parseFloat(c[3]);
                c = that.maxColor.split('(')[1].split(')')[0];
                c = c.split(',');
                var maxRed = parseInt(c[0]);
                var maxGreen = parseInt(c[1]);
                var maxBlue = parseInt(c[2]);
                var maxAlpha = parseFloat(c[3]);

                red += Math.floor(((itemData[that.valueMember] - minValue) / valueRange) * (maxRed - red));
                green += Math.floor(((itemData[that.valueMember] - minValue) / valueRange) * (maxGreen - green));
                blue += Math.floor(((itemData[that.valueMember] - minValue) / valueRange) * (maxBlue - blue));
                alpha += ((itemData[that.valueMember] - minValue) / valueRange) * (maxAlpha - alpha);
                tagItem[0].style.color = 'rgba(' + red + ',' + green + ',' + blue + ',' + alpha + ')';


                tagItem.find('a')[0].style.color = 'inherit';
            } else if (that.textColor !== null){
                tagItem[0].style.color = that.textColor;
                tagItem.find('a')[0].style.color = 'inherit';
            }
            return tagItem;

        },

        _parseColor: function(color){
            function colourNameToHex(colour)
            {
                var colours = {'aliceblue':'#f0f8ff','antiquewhite':'#faebd7','aqua':'#00ffff','aquamarine':'#7fffd4','azure':'#f0ffff',
                    'beige':'#f5f5dc','bisque':'#ffe4c4','black':'#000000','blanchedalmond':'#ffebcd','blue':'#0000ff','blueviolet':'#8a2be2','brown':'#a52a2a','burlywood':'#deb887',
                    'cadetblue':'#5f9ea0','chartreuse':'#7fff00','chocolate':'#d2691e','coral':'#ff7f50','cornflowerblue':'#6495ed','cornsilk':'#fff8dc','crimson':'#dc143c','cyan':'#00ffff',
                    'darkblue':'#00008b','darkcyan':'#008b8b','darkgoldenrod':'#b8860b','darkgray':'#a9a9a9','darkgreen':'#006400','darkkhaki':'#bdb76b','darkmagenta':'#8b008b','darkolivegreen':'#556b2f',
                    'darkorange':'#ff8c00','darkorchid':'#9932cc','darkred':'#8b0000','darksalmon':'#e9967a','darkseagreen':'#8fbc8f','darkslateblue':'#483d8b','darkslategray':'#2f4f4f','darkturquoise':'#00ced1',
                    'darkviolet':'#9400d3','deeppink':'#ff1493','deepskyblue':'#00bfff','dimgray':'#696969','dodgerblue':'#1e90ff',
                    'firebrick':'#b22222','floralwhite':'#fffaf0','forestgreen':'#228b22','fuchsia':'#ff00ff',
                    'gainsboro':'#dcdcdc','ghostwhite':'#f8f8ff','gold':'#ffd700','goldenrod':'#daa520','gray':'#808080','green':'#008000','greenyellow':'#adff2f',
                    'honeydew':'#f0fff0','hotpink':'#ff69b4',
                    'indianred ':'#cd5c5c','indigo':'#4b0082','ivory':'#fffff0','khaki':'#f0e68c',
                    'lavender':'#e6e6fa','lavenderblush':'#fff0f5','lawngreen':'#7cfc00','lemonchiffon':'#fffacd','lightblue':'#add8e6','lightcoral':'#f08080','lightcyan':'#e0ffff','lightgoldenrodyellow':'#fafad2',
                    'lightgrey':'#d3d3d3','lightgreen':'#90ee90','lightpink':'#ffb6c1','lightsalmon':'#ffa07a','lightseagreen':'#20b2aa','lightskyblue':'#87cefa','lightslategray':'#778899','lightsteelblue':'#b0c4de',
                    'lightyellow':'#ffffe0','lime':'#00ff00','limegreen':'#32cd32','linen':'#faf0e6',
                    'magenta':'#ff00ff','maroon':'#800000','mediumaquamarine':'#66cdaa','mediumblue':'#0000cd','mediumorchid':'#ba55d3','mediumpurple':'#9370d8','mediumseagreen':'#3cb371','mediumslateblue':'#7b68ee',
                    'mediumspringgreen':'#00fa9a','mediumturquoise':'#48d1cc','mediumvioletred':'#c71585','midnightblue':'#191970','mintcream':'#f5fffa','mistyrose':'#ffe4e1','moccasin':'#ffe4b5',
                    'navajowhite':'#ffdead','navy':'#000080',
                    'oldlace':'#fdf5e6','olive':'#808000','olivedrab':'#6b8e23','orange':'#ffa500','orangered':'#ff4500','orchid':'#da70d6',
                    'palegoldenrod':'#eee8aa','palegreen':'#98fb98','paleturquoise':'#afeeee','palevioletred':'#d87093','papayawhip':'#ffefd5','peachpuff':'#ffdab9','peru':'#cd853f','pink':'#ffc0cb','plum':'#dda0dd','powderblue':'#b0e0e6','purple':'#800080',
                    'red':'#ff0000','rosybrown':'#bc8f8f','royalblue':'#4169e1',
                    'saddlebrown':'#8b4513','salmon':'#fa8072','sandybrown':'#f4a460','seagreen':'#2e8b57','seashell':'#fff5ee','sienna':'#a0522d','silver':'#c0c0c0','skyblue':'#87ceeb','slateblue':'#6a5acd','slategray':'#708090','snow':'#fffafa','springgreen':'#00ff7f','steelblue':'#4682b4',
                    'tan':'#d2b48c','teal':'#008080','thistle':'#d8bfd8','tomato':'#ff6347','turquoise':'#40e0d0',
                    'violet':'#ee82ee',
                    'wheat':'#f5deb3','white':'#ffffff','whitesmoke':'#f5f5f5',
                    'yellow':'#ffff00','yellowgreen':'#9acd32'};

                if (typeof colours[colour.toLowerCase()] != 'undefined')
                    return colours[colour.toLowerCase()];

                return false;
            }

            var el = $('<span>').css('color', color);
            color = el.css('color');
            var r, g, b;
            if (color.substr(0,4) === 'rgba') {
                return color;
            } else if (color.substr(0,3) === 'rgb'){
                var c = color.split('(')[1].split(')')[0];
                c = c.split(',');
                r = parseInt(c[0]);
                g = parseInt(c[1]);
                b = parseInt(c[2]);
                return ('rgba(' + r + ',' + g + ',' + b +',1)');
            } else if (color.substr(0,1) === '#' && color.length === 7){
                r = parseInt(color.substr(1, 2), 16);
                g = parseInt(color.substr(3, 2), 16);
                b = parseInt(color.substr(5, 2), 16);
                return ('rgba(' + r + ',' + g + ',' + b +',1)');
            } else if (color.substr(0,1) === '#' && color.length === 4){
                r = parseInt(color.substr(1, 1) + color.substr(1, 1), 16);
                g = parseInt(color.substr(2, 1) + color.substr(2, 1), 16);
                b = parseInt(color.substr(3, 1) + color.substr(3, 1), 16);
                return ('rgba(' + r + ',' + g + ',' + b +',1)');
            } else if (color = colourNameToHex(color)){
                r = parseInt(color.substr(1, 2), 16);
                g = parseInt(color.substr(3, 2), 16);
                b = parseInt(color.substr(5, 2), 16);
                return ('rgba(' + r + ',' + g + ',' + b +',1)');
            }
            return color;
        },

        _events: ['itemClick', 'bindingUpdateComplete', 'bindingComplete'],

        _raiseEvent: function (eventId, args) {
            var eventType = this._events[eventId],
                event = $.Event(eventType);
            event.args = args;
            return this.host.trigger(event);
        },

        _filter: function (data) {
            var that = this;

            if (that.minValueToDisplay != 0) {
                for (var i = 0; i < data.length;) {
                    if (data[i][that.valueMember] < that.minValueToDisplay) {
                        data.splice(i, 1);
                    } else {
                        i++;
                    }
                }
            }

            if (that.maxValueToDisplay != 0) {
                for (var i = 0; i < data.length;) {
                    if (data[i][that.valueMember] > that.maxValueToDisplay) {
                        data.splice(i, 1);
                    } else {
                        i++;
                    }
                }
            }

            if (that.displayLimit != null && !isNaN(that.displayLimit)) {
                if (that.takeTopWeightedItems === true) {
                    data.sort(function (a, b) {
                        if (a[that.valueMember] < b[that.valueMember]) {
                            return 1;
                        }
                        if (a[that.valueMember] > b[that.valueMember]) {
                            return -1;
                        }
                        return 0;
                    });
                    data = data.slice(0, that.displayLimit);
                    data.sort(function (a, b) {
                        if (a.index < b.index) {
                            return -1;
                        }
                        if (a.index > b.index) {
                            return 1;
                        }
                        return 0;
                    });
                }
                else {
                    data = data.slice(0, that.displayLimit);
                }
            }
            return data;
        },

        _sort: function (data) {
            var that = this;
            if (that.sortBy !== 'none') {
                if (that.sortBy === 'label') {
                    data.sort(function (a, b) {
                        if (a[that.displayMember] < b[that.displayMember]) { return -1; }
                        if (a[that.displayMember] > b[that.displayMember]) { return 1; }
                        return 0;
                    });
                }
                else if (that.sortBy === 'value') {
                    data.sort(function (a, b) {
                        if (a[that.valueMember] < b[that.valueMember]) { return -1; }
                        if (a[that.valueMember] > b[that.valueMember]) { return 1; }
                        return 0;
                    });
                } else {
                    throw new Error("jqxTagCloud: sortBy option needs to be either 'none' or 'label' or 'value'");
                }

                if (that.sortOrder === 'ascending') {
                    return data;
                } else if (that.sortOrder === 'descending') {
                    return data.reverse();
                } else {
                    throw new Error("jqxTagCloud: sortOrder option needs to be either 'ascending' or 'descending'");
                }
            }
            return data;
        },

        _getMaxValue: function (data) {
            var that = this;
            var max = data[0][that.valueMember];
            for (var i = 0; i < data.length; i++) {
                if (max < data[i][that.valueMember]) {
                    max = data[i][that.valueMember];
                }
            }
            return max;
        },

        _getMinValue: function (data) {
            var that = this;
            var min = data[0][that.valueMember];
            for (var i = 0; i < data.length; i++) {
                if (min > data[i][that.valueMember]) {
                    min = data[i][that.valueMember];
                }
            }
            return min;
        },

        _setSourceData: function (source) {
            var that = this;
            that.records = source.records;
            for (var i = 0; i < that.records.length; i++) {
                var val = that.records[i][that.valueMember] !== undefined ? parseFloat(that.records[i][that.valueMember]) : 0;
                that.records[i][that.valueMember] = isNaN(val) ? 0 : val;
                that.records[i].index = i;
            }
            that.hiddenList = [];
        },

        _updateColor: function (){
            var that = this;
            if(that.textColor){
                $(that._el).find('li').css('color', that.textColor);
            }
        },

        _updateSize: function () {
            var that = this;
            if (that.width) {
                that.host.width(that.width);
            }
            if (that.height) {
                that.host.height(that.height);
            }
        },

        _setRtl: function () {
            var that = this;
            if (that.rtl) {
                that.host.addClass(that.toThemeProperty('jqx-rtl'));
            } else {
                that.host.removeClass(that.toThemeProperty('jqx-rtl'));
            }
        }

    });
})(jqxBaseFramework);
})();




/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/amd options */
/******/ 	(() => {
/******/ 		__webpack_require__.amdO = {};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";
/* harmony import */ var _jqxcore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(5459);
/* harmony import */ var _jqxcore__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jqxcore__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _jqxbuttons__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(7351);
/* harmony import */ var _jqxbuttons__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_jqxbuttons__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _jqxbuttongroup__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(7196);
/* harmony import */ var _jqxbuttongroup__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_jqxbuttongroup__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _jqxscrollbar__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4240);
/* harmony import */ var _jqxscrollbar__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_jqxscrollbar__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _jqxmenu__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(1610);
/* harmony import */ var _jqxmenu__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_jqxmenu__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _jqxtagcloud__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(9703);
/* harmony import */ var _jqxtagcloud__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_jqxtagcloud__WEBPACK_IMPORTED_MODULE_5__);






})();

/******/ })()
;