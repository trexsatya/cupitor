
/* Release Date: Jan-28-2025 
Copyright (c) 2011-2025 jQWidgets. 
License: https://jqwidgets.com/license/ */


/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

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

/***/ 3962:
/***/ (() => {

/* tslint:disable */
/* eslint-disable */
(function(){
	if (typeof document === 'undefined') { 
		return;
	}

(function ($) {

    $.jqx.jqxWidget("jqxDocking", "", {});

    $.extend($.jqx._jqxDocking.prototype, {

        defineInstance: function () {
            var settings = {
                // Type: String
                // Default: 'horizontal'
                // Sets or gets docking's orientation
                orientation: 'horizontal',
                // Type: String
                // Default: default
                // Sets or gets docking's mode. Possible values - default, floating, docked
                mode: 'default',
                // Type: Number
                // Default: 0.3
                // Sets or gets docking's floating window's opacity
                floatingWindowOpacity: 0.3,
                // Type: Bool
                // Default: true
                // Sets or gets whether the panel's corners are rounded
                panelsRoundedCorners: true,
                // Type: Bool
                // Default: false
                // Sets or gets whether the dicking is disabled
                disabled: false,
                // Type: String/Number
                // Default: auto
                // Sets or gets docking's width
                width: 'auto',
                // Type: String/Number
                // Default: auto
                // Sets or gets docking's height
                height: 'auto',
                // Type: Object
                // Default: null
                // Sets or gets docking window's modes (each one could be in floating or default mode)
                windowsMode: null,
                // Type: Bool
                // Default: true
                // Sets or gets whether the current layout would be saved into cookies
                cookies: false,
                // Type: Object
                // Default: {}
                // Sets or gets cookie options
                cookieOptions: {},
                // Type: Number
                // Default: 5
                // Sets or gets window's offset
                windowsOffset: 5,
                rtl: false,
                keyboardNavigation: false,
                _windowOptions: {},
                _draggedFired: false,
                _dragging: false,
                _draggingItem: null,
                _panels: [],
                _windows: [],
                _indicator: null,
                _events: ['dragEnd', 'dragStart']
            };
            if (this === $.jqx._jqxDocking.prototype) {
                return settings;
            }
           $.extend(true, this, settings);
           return settings;
        },

        createInstance: function () {
            if (!this.host.jqxWindow) {
                throw new Error("jqxDocking: Missing reference to jqxwindow.js.");
            }

            this._refresh(true);
            if (this.disabled) {
                this.disabled = false;
                this.disable();
            }
        },

        refresh: function (initialRefresh) {
            if (initialRefresh == true)
                return;

            this._performLayout();
        },

        _refresh: function (startup) {
            this._render();
            this._removeClasses();
            this._addClasses();
            this._setWindowsOptions(true);
            this._performLayout();
            this._cookieHandler();
            this._cookieExporter();
            this._removeEventListeners();
            this._addEventListeners();
            var event = $.Event('resize');
            this.host.trigger(event);
        },

        resize: function()
        {
            this._refresh();
        },

        _addClasses: function () {
            this.host.addClass('jqx-docking');
            for (var i = 0; i < this._panels.length; i += 1) {
                this._panels[i].addClass(this.toThemeProperty('jqx-docking-panel'));
                if (this.panelsRoundedCorners) {
                    this._panels[i].addClass(this.toThemeProperty('jqx-rc-all'));
                }
            }
            for (var i = 0; i < this._windows.length; i += 1) {
                this._windows[i].addClass(this.toThemeProperty('jqx-docking-window'));
            }
        },

        _removeClasses: function () {
            this.host.removeClass('jqx-docking');
            for (var i = 0; i < this._panels.length; i += 1) {
                this._panels[i].removeClass(this.toThemeProperty('jqx-docking-panel'));
                this._panels[i].removeClass(this.toThemeProperty('jqx-rc-all'));
            }
            for (var i = 0; i < this._windows.length; i += 1) {
                this._windows[i].removeClass(this.toThemeProperty('jqx-docking-window'));
            }
        },

        _render: function () {
            var panels = this.host.children('div'), windows;
            for (var i = 0; i < panels.length; i += 1) {
                this._panels.push($(panels[i]));
                this._renderWindows($(panels[i]));
            }
        },

        focus: function(window)
        {
            if (this.focusedWindow) {
                $(this.focusedWindow).removeClass(this.toThemeProperty('jqx-fill-state-focus'));
            }

            if (!$.isEmptyObject(window) && $.type(window) === "string" && $("#" + window).length > 0) {
                this.focusedWindow = $("#" + window)[0];
            }
            else {
                this.focusedWindow = this._windows[0][0];
            }
            $(this.focusedWindow).addClass(this.toThemeProperty('jqx-fill-state-focus'));
            this.host.focus();
        },

        _renderWindows: function (panel) {
            var windows = panel.children('div');
            for (var j = 0; j < windows.length; j += 1) {
                this._windows.push($(windows[j]));
                $(windows[j]).jqxWindow({ keyboardNavigation: false, rtl: this.rtl, theme: this.theme, enableResize: false, width: $(windows[j]).css('width'), maxWidth: Number.MAX_VALUE });
                $(windows[j]).detach();
                panel.append($(windows[j]));
            }
            panel.append('<div class="spacer" style="clear: both;"></div>');

            var that = this;
            if (this.keyboardNavigation) {
                var handleKeyDown = function (event) {
                    if (event.keyCode === 13) {
                        if (that.focusedWindow && $(that.focusedWindow).jqxWindow('showCollapseButton')) {
                            $(that.focusedWindow).jqxWindow('_collapseButton').trigger('click');
                        }
                    }
                    else if ((that.focusedWindow && event.keyCode === 27 && $(that.focusedWindow).jqxWindow('keyboardCloseKey') === "esc") || (that.focusedWindow && $(that.focusedWindow).jqxWindow('keyboardCloseKey') == event.keyCode)) {
                        $(that.focusedWindow).jqxWindow('closeWindow', event);
                    }

                    if (event.keyCode === 9) {
                        if (that.focusedWindow == null) {
                            that.focusedWindow = that._windows[0];
                            $(that.focusedWindow).focus();
                            event.stopPropagation();
                        }
                        else {
                            var index = -1;
                            $.each(that._windows, function (indx, value) {
                                if (this[0] == that.focusedWindow) {
                                    index = indx;
                                }
                            });
                            if (event.shiftKey) {
                                index--;
                            }
                            else {
                                index++;
                            }

                            if (index >= that._windows.length || index < 0) {
                                $(that.focusedWindow).removeClass(that.toThemeProperty('jqx-fill-state-focus'));
                                that.focusedWindow = null;
                                event.stopPropagation();
                             
                                return true;
                            }

                            var window = that._windows[index];
                            if (!window) window = that._windows[0];
                            $(that.focusedWindow).removeClass(that.toThemeProperty('jqx-fill-state-focus'));
                            that.focusedWindow = window[0];
                            $(that.focusedWindow).focus();
                        }
                        $(that.focusedWindow).addClass(that.toThemeProperty('jqx-fill-state-focus'));
                        if (event.preventDefault) {
                            event.preventDefault();
                            event.stopPropagation();
                        }
                    }
                }

                $.each(that._windows, function (indx, value) {
                    var window = $(this);
                    that.removeHandler(window, "focus");
                    that.removeHandler(window, "blur");

                    that.removeHandler(window, "mousedown");
                    that.addHandler(window, "mousedown", function (event) {
                        if (that.focusedWindow)
                        {
                            $(that.focusedWindow).removeClass(that.toThemeProperty('jqx-fill-state-focus'));
                        }
                            
                        that.focusedWindow = window[0];
                        $(that.focusedWindow).addClass(that.toThemeProperty('jqx-fill-state-focus'));
                        $(that.focusedWindow).focus();
                    });

                    that.addHandler(window, "focus", function (event) {
                        if (that.focusedWindow) {
                            $(that.focusedWindow).removeClass(that.toThemeProperty('jqx-fill-state-focus'));
                        }

                        that.focusedWindow = window[0];
                        $(that.focusedWindow).addClass(that.toThemeProperty('jqx-fill-state-focus'));
                    });

                    that.addHandler(window, "blur", function (event) {
                        if ($(document.activeElement).ischildof($(window)))
                            return true;

                        $(window).removeClass(that.toThemeProperty('jqx-fill-state-focus'));
                    });
                    that.removeHandler(window, 'keydown');
                    that.addHandler(window, 'keydown', function (event) {
                        handleKeyDown(event);
                    });
                });
                
                this.removeHandler(this.host, 'keydown');
                this.addHandler(this.host, 'keydown', function (event) {
                    handleKeyDown(event);
                });
                this.removeHandler(this.host, 'blur');
                this.addHandler(this.host, 'blur', function (event) {
                    if (that.focusedWindow) {
                        $(that.focusedWindow).removeClass(that.toThemeProperty('jqx-fill-state-focus'));
                        that.focusedWindow = null;
                    }
                });
            }
        },

        _performLayout: function () {
            this.host.css('width', this.width);
            this.host.css('height', this.height);
            this._performWindowsLayout();
            this._performPanelsLayout();
            this._performWindowsLayout();
        },

        _performPanelsLayout: function ()
        {
            this.host.css('overflow', 'hidden');
            var panel, hostWidth = this.host.width(), sizeSum = 0;
            for (var i = 0; i < this._panels.length; i += 1) {
                panel = this._panels[i];
                panel.css('height', 'auto');
                panel.css('min-width', 'auto');
                panel[0].style.width = "auto";
                if (this.orientation === 'vertical')
                {
                    panel.css('width', 'auto');
                    panel.css('float', 'none');
                } else {
                    sizeSum += this._handleHorizontalSize(panel, sizeSum, hostWidth);
                    if (i > 0)
                        panel.css('margin-left', -this.windowsOffset);
                }
             //   panel.css('min-width', panel.width());
            }
            if (this.orientation === 'horizontal') {
                if (sizeSum < hostWidth) {
                    this._fillContainer(hostWidth, sizeSum);
                }
            }
        },

        _handleHorizontalSize: function (panel, sizeSum, hostWidth) {
            var midWidth = hostWidth / this._panels.length,
                size,
                difference = (panel.outerWidth() - panel.width());
            panel.css('float', 'left');
            if (panel[0].style.width === 'auto' || parseInt(panel.css('width'), 10) === 0)
            {
                var outlineDifference = difference / hostWidth * 100;

                var percentage = 99.99 / this._panels.length;
                panel[0].style.width =  percentage + "%";
                return panel.outerWidth();
            }
            if (sizeSum + panel.outerWidth() >= hostWidth) {
                if (sizeSum + midWidth < hostWidth) {
                    size = midWidth - difference;
                    panel.css('min-width', size);
                    panel.width(size);
                } else {
                    size = panel.width() - ((sizeSum + panel.outerWidth()) - hostWidth);
                    panel.css('min-width', size);
                    panel.width(size);
                }
            }
            return panel.outerWidth();
        },

        _fillContainer: function (hostWidth, sizeSum) {
            var count = this._panels.length, lastPanel = this._panels[count - 1],
                size = hostWidth - sizeSum + lastPanel.width();
            if ($.jqx.browser.msie && $.jqx.browser.version < 9) {
                size -= this._panels.length;
            }
            return;
            lastPanel.width(size);
        },

        _performWindowsLayout: function () {
            var options;
            for (var i = 0; i < this._windows.length; i += 1) {
                options = this._getWindowOptions(this._windows[i]);
                if (this._windows[i].ischildof(this.host)) {
                    if (options) {
                        if (options.mode !== 'floating') {
                            this._windows[i].css('margin', this.windowsOffset);
                            this._windows[i].css('position', 'static');
                        }
                    } else {
                        if (this.mode !== 'floating') {
                            this._windows[i].css('position', 'static');
                            this._windows[i].css('margin', this.windowsOffset);
                        }
                    }
                }
                this._setWindowSize(this._windows[i], options);
            }
        },

        _setWindowSize: function (window, options) {
            if (options.mode !== 'floating') {
                if (window.ischildof(this.host)) {
                    var newSize = window.parent().width() - (window.outerWidth() - window.width()) - 2 * this.windowsOffset;
                    if (this.orientation === 'vertical') {
                        window.jqxWindow('width', newSize);
                    } else {
                        window.jqxWindow('width', newSize);
                    }
                }
            }
            this._setWindowOption(window, 'size', {
                width: window.width(),
                height: window.height()
            });
        },

        _setWindowsOptions: function (fullOptions) {
            for (var i = 0; i < this._windows.length; i += 1) {
                var mode,
                    windowId = this._windows[i].attr('id'),
                    options = this._getWindowOptions(windowId);
                if (!fullOptions) {
                    var t = 'TEDX';
                }

                mode = null;
                if (this.windowsMode && this.windowsMode.hasOwnProperty(windowId)) {
                    mode = this.windowsMode[windowId];
                    this._setWindowOption(this._windows[i], 'mode', mode);
                } else if (typeof options !== 'undefined' && typeof options['mode'] === 'undefined') {
                    mode = this.mode;
                    this._setWindowOption(this._windows[i], 'mode', mode);
                }
                if (fullOptions) {
                    this._setWindowOption(this._windows[i], 'resizable', true);
                    if (mode == 'floating') {
                        this._windows[i].jqxWindow({ enableResize: true });
                    }
                    else {
                        this._windows[i].jqxWindow({ enableResize: false });
                    }

                    this._setWindowOption(this._windows[i], 'size', { height: this._windows[i].height(), width: this._windows[i].width() });
                }
            }
        },

        _removeEventListeners: function () {
            for (var i = 0; i < this._windows.length; i += 1) {
                this.removeHandler(this._windows[i], 'moving', this._itemDragging);
                this.removeHandler(this._windows[i], 'moved', this._itemDrop);
                this.removeHandler(this._windows[i], 'resized', this._itemResized);
                this.removeHandler(this._windows[i], 'collapse', this._collapsed);
                this.removeHandler(this._windows[i], 'expand', this._expanded);
            }
        },

        _addEventListeners: function () {
            for (var i = 0; i < this._windows.length; i += 1) {
                this._addEventListenersTo(this._windows[i]);
            }

            var me = this;
            $.jqx.utilities.resize(this.host, function () {
                me._performLayout();
            });
        },

        _addEventListenersTo: function (window) {
            this.addHandler(window, 'moving', this._itemDragging, { self: this });
            this.addHandler(window, 'moved', this._itemDrop, { self: this });
            this.addHandler(window, 'resized', this._itemResized, { self: this });
            this.addHandler(window, 'collapse', this._collapsed, { self: this });
            this.addHandler(window, 'expand', this._expanded, { self: this });
        },

        _itemDragging: function (event) {
            var self = event.data.self,
                window = $(event.target),
                options = self._getWindowOptions(window);
            window.removeClass(self.toThemeProperty('jqx-docking-window'));
            window.css('margin', '0px');
            if (!self._dragging) {
                self._prepareForDragging(window);
            }
            if (options.mode === 'floating') {
                return;
            }
            var position = { x: event.args.pageX, y: event.args.pageY },
                panel = self._getMouseOverPanel(position);
            if (panel) {
                self._mouseOverPanel(panel, position);
            } else {
                self._mouseLeavePanel();
            }
            if (!self._draggedFired) {
                self._raiseEvent(1, { window: $(window).attr('id') });
                self._draggedFired = true;
            }
          //  window.focus();
            return true;
        },

        _prepareForDragging: function (window) {
            this._dragging = true;
            var lastPosition = {
                parent: window.parent(),
                next: window.next(),
                prev: window.prev()
            };
            this._setWindowOption(window, 'lastPosition', lastPosition);
            window.detach();
            $(document.body).append(window);
            this._setDraggingStyles(window);
            this._draggingItem = window;
        },

        _setDraggingStyles: function (window) {
            window.css({
                'position': 'absolute',
                'left': window.offset().left,
                'top': window.offset().top
            });
            window.fadeTo(0, this.floatingWindowOpacity);
        },

        _getMouseOverPanel: function (cursorPosition) {
            var width, height, top, left;
            for (var i = 0; i < this._panels.length; i += 1) {
                if (this._isMouseOverItem(this._panels[i], cursorPosition, false)) {
                    return this._panels[i];
                }
            }
            return null;
        },

        _mouseOverPanel: function (panel, position) {
            if (this._dragging) {
                var windows = panel.children('div'),
                    window = this._getHoverWindow(position, windows);
                if (window === 'indicator') {
                    return;
                }
                var indicatorPosition = this._centerOffset(window, position);
                this._handleIndicator(panel, window, indicatorPosition);
            }
        },

        _getHoverWindow: function (position, windows) {
            var width, height, left, top;
            if (this._isMouseOverItem(this._indicator, position, true)) {
                return 'indicator';
            }
            for (var i = 0; i < windows.length; i += 1) {
                if (this._isMouseOverItem($(windows[i]), position, true)) {
                    return $(windows[i]);
                }
            }
            return null;
        },

        _centerOffset: function (window, position) {
            if (window) {
                var windowPosition = { x: window.offset().left, y: window.offset().top },
                    windowHeight = window.height(),
                    windowWidth = window.width(), middle;
                middle = windowPosition.y + windowHeight / 2;
                if (position.y > middle) {
                    return 'next';
                }
                return 'prev';
            }
            return 'all';
        },

        _handleIndicator: function (panel, window, indicatorPosition) {
            var indicator = this._getIndicator(window);
            if (indicatorPosition === 'all') {
                if (this.orientation === 'vertical') {
                    indicator.insertBefore(panel.children('.spacer'));
                } else {
                    panel.append(indicator);
                }
            } else {
                if (indicatorPosition === 'prev') {
                    indicator.insertBefore(window);
                } else {
                    indicator.insertAfter(window);
                }
            }
            this._resizeIndicator(indicator, panel);
        },

        _getIndicator: function () {
            var indicator = this._indicator;
            if (!indicator) {
                indicator = $('<div class="' + this.toThemeProperty('jqx-docking-drop-indicator') + '"></div>');
            }
            this._indicator = indicator;
            this._indicator.css('margin', this.windowsOffset);
            if (this.orientation === 'vertical') {
                this._indicator.css('float', 'left');
            }
            return indicator;
        },

        _resizeIndicator: function (indicator, panel) {
            if (this.orientation === 'horizontal') {
                indicator.width(panel.width() - (indicator.outerWidth(true) - indicator.width()));
                indicator.height(this._draggingItem.height());
            } else {
                indicator.width(this._draggingItem.width());
                indicator.height(this._draggingItem.height());
            }
        },

        _mouseLeavePanel: function (event) {
            if (this._indicator) {
                this._indicator.remove();
                this._indicator = null;
            }
        },

        _itemDrop: function (event) {
            var self = event.data.self,
                window = $(event.currentTarget);
            self._dragging = false;
            if (self._indicator) {
                window.detach();
                window.insertAfter(self._indicator);
                self._indicator.remove();
                self._dropFixer(window);
            } else {
                self._dropHandler(window);
            }
            window.fadeTo(0, 1);
            window.focus();
            self._indicator = null;
            self._cookieExporter();
            self._draggedFired = false;
            self._raiseEvent(0, { window: window.attr('id') });
        },

        _dropFixer: function (window) {
            window.css('position', 'static');
            window.addClass(this.toThemeProperty('jqx-docking-window'));
            window.css('margin', this.windowsOffset);
            window.jqxWindow('enableResize', false);
            if (this.orientation === 'horizontal') {
                this._fixWindowSize(window);
            }
        },

        _dropHandler: function (window) {
            var options = this._getWindowOptions(window);
            if (this.mode === 'docked') {
                this._dropDocked(window);
            } else {
                this._dropFloating(window);
            }
        },

        _dropDocked: function (window) {
            var options = this._getWindowOptions(window),
                lastPosition = options.lastPosition;
            window.detach();
            if (lastPosition.next[0]) {
                window.insertBefore(lastPosition.next);
            } else if (lastPosition.prev[0]) {
                window.insertAfter(lastPosition.prev);
            } else {
                lastPosition.parent.append(window);
            }
            this._dropFixer(window);
        },

        _fixWindowSize: function (window) {
            $(window).jqxWindow({
                width: window.parent().width() - (window.outerWidth() - window.width()) - 2 * parseInt(this.windowsOffset, 10)
            });
        },

        _itemResized: function (event) {
            var self = event.data.self,
                window = $(event.currentTarget);
            self._setWindowOption(window, 'size', { width: event.args.width, height: event.args.height });
            self._cookieExporter();
        },

        _dropFloating: function (window) {
            var options;
            if (!$(window).jqxWindow('collapsed')) {
                options = this._getWindowOptions(window);
                $(window).jqxWindow('enableResize', options.resizable);
            }
            $(document.body).append(window);
            this._restoreWindowSize(window);
        },

        _restoreWindowSize: function (window) {
            var options = this._getWindowOptions(window);
            $(window).jqxWindow({ width: options.size.width });
        },

        _isMouseOverItem: function (item, position, outerSize) {
            if (!item) {
                return false;
            }
            var outerWidth = item.outerWidth(true), outerHeight = item.outerHeight(true),
                width = item.width(), height = item.height(),
                top = item.offset().top, left = item.offset().left;
            if (outerSize) {
                top -= (outerHeight - height) / 2;
                left -= (outerWidth - width) / 2;
                width = outerWidth;
                height = outerHeight;
            }
            if ((left <= position.x && left + width >= position.x) &&
                (top <= position.y && top + height + 2 * this._draggingItem.height() / 3 >= position.y)) {
                return true;
            }
            return false;
        },

        _cookieHandler: function () {
            if (this.cookies) {
                var layout = $.jqx.cookie.cookie("jqxDocking" + this.element.id);
                if (layout !== null) {
                    this.importLayout(layout);
                    this.layoutImported = true;
                }
            }
        },

        _cookieExporter: function () {
            if (this.cookies) {
                $.jqx.cookie.cookie("jqxDocking" + this.element.id, this.exportLayout(), this.cookieOptions);
            }
        },

        _indexOf: function (item, collection) {
            for (var i = 0; i < collection.length; i += 1) {
                if (item[0] === collection[i][0]) {
                    return i;
                }
            }
            return -1;
        },

        _exportFixed: function () {
            var children = [], JSON = '', currentChildren, currentChild;
            for (var i = 0; i < this._panels.length; i += 1) {
                JSON += '"panel' + i + '": {';
                currentChildren = this._panels[i].children();
                for (var j = 0; j < currentChildren.length; j += 1) {
                    currentChild = $(currentChildren[j]);
                    if (currentChild.attr('id')) {
                        children.push(currentChild);
                        JSON += '"' + currentChild.attr('id') + '":{"collapsed":' + currentChild.jqxWindow('collapsed') + '},';
                    }
                }
                if (currentChildren.length > 1) {
                    JSON = JSON.substring(0, JSON.length - 1);
                }
                JSON += '},';
            }
            JSON = JSON.substring(0, JSON.length - 1);
            return { JSON: JSON, children: children };
        },

        _exportFloating: function (children) {
            var JSON = '', currentWindow;
            JSON += '"floating":{'
            for (var i = 0; i < this._windows.length; i += 1) {
                currentWindow = $(this._windows[i]);
                if (this._indexOf(currentWindow, children) === -1) {
                    JSON += '"' + currentWindow.attr('id') +
                        '":{"x":"' + currentWindow.css('left') + '","y":"' + currentWindow.css('top') + '",' +
                        '"width":"' + currentWindow.jqxWindow('width') + '","height":' + '"' + currentWindow.jqxWindow('height') + '",' +
                        '"collapsed":' + currentWindow.jqxWindow('collapsed') + '},';
                }
            }
            if (JSON.substring(JSON.length - 1, JSON.length) === ',') {
                JSON = JSON.substring(0, JSON.length - 1);
            }
            JSON += '}';
            return JSON;
        },

        _importFixed: function (imported) {
            for (var child in imported) {
                if (child !== 'orientation' && child !== 'floating' && imported.hasOwnProperty(child)) {
                    var order = child.substring(child.length - 1, child.length);
                    order = parseInt(order, 10);
                    var children = imported[child];
                    for (var child in children) {
                        $('#' + child).css('position', 'static');
                        if (children[child].collapsed) {
                            (function (child) {
                                setTimeout(function () {
                                    $('#' + child).jqxWindow('collapsed', true);
                                }, 0);
                            } (child));
                        }
                        this._panels[order].append($('#' + child));
                        if (this.orientation === 'horizontal') {
                            this._fixWindowSize($('#' + child));
                        }
                    }
                }
            }
        },

        _importFloating: function (imported) {
            var floating = imported['floating'],
                currentWindow,
                temp;
            for (var id in floating) {
                if (floating.hasOwnProperty(id)) {
                    $('#' + id).css('position', 'absolute');
                    $(document.body).append($('#' + id));
                    temp = this._dragging;
                    $('#' + id).jqxWindow('move', floating[id].x, floating[id].y);
                    this._dragging = temp;
                    $('#' + id).jqxWindow('width', floating[id].width);
                    $('#' + id).jqxWindow('height', floating[id].height);
                    $('#' + id).jqxWindow('enableResize', true);
                    this._setWindowsOptions(true);
                    (function (id) {
                        setTimeout(function () {
                            $('#' + id).jqxWindow('collapsed', floating[id].collapsed);
                        }, 0);
                    } (id));
                    $('#' + id).fadeTo(0, 1);
                }
            }
        },

        _getWindowOptions: function (window) {
            if (typeof window === 'object' && window !== null) {
                if (window.length > 0) {
                    window = window.attr('id');
                } else {
                    window = window.id;
                }
            }
            return this._windowOptions[window];
        },

        _setWindowOption: function (window, option, value) {
            if (typeof window === 'object' && window !== null) {
                if (window.length > 0) {
                    window = window.attr('id');
                } else {
                    window = window.id;
                }
            }
            if (typeof this._windowOptions[window] === 'undefined') {
                this._windowOptions[window] = {};
            }
            this._windowOptions[window][option] = value;
            if (option === 'mode') {
                this.setWindowMode(window, value);
            }
        },

        _expanded: function (event) {
            var self = event.data.self;
            self._cookieExporter();
        },

        _collapsed: function (event) {
            var self = event.data.self;
            self._cookieExporter();
        },

        _raiseEvent: function (eventId) {
            var event = $.Event(this._events[eventId]);
            event.args = arguments[1];
            return this.host.trigger(event);
        },

        _moveWindow: function (window, panel, position) {
            var children = panel.children();
            var child = null;
            var pos = 0;
            $.each(children, function (i) {
                if ($(this).css('position') == 'static') {
                    if (pos == position && this != window[0]) {
                        child = this;
                    }
                    pos++;
                }
            });

            if (pos <= position) {
                window.appendTo(panel);
            }
            else if (child != null) {
                window.insertBefore(child);
            }

            window.css('position', 'static');
        },

        propertyChangedHandler: function (object, key, oldvalue, value) {
            switch (key) {
                case 'rtl':
                    $.each(object._windows, function () {
                        this.jqxWindow({ rtl: value });
                    });
                    break;
                case 'theme':
                    $.each(object._windows, function () {
                        this.jqxWindow({ theme: value });
                    });
                    break;
                case 'orientation':
                case 'height':
                case 'width':
                    object._performLayout();
                    object._cookieExporter();
                    break;
                case 'panelsRoundedCorners':
                    object._removeClasses();
                    object._addClasses();
                    break;
                case 'disabled':
                    if (value) {
                        object.disabled = false;
                        object.disable();
                    } else {
                        object.disabled = true;
                        object.enable();
                    }
                    break;
                case 'windowsMode':
                case 'mode':
                    object._setWindowsOptions(false);
                    break;
                case 'cookies':
                    object._cookieExporter();
                    break;
                case 'windowsOffset':
                    object._performLayout();
                    break;
            }
        },

        destroy: function () {
            this._removeEventListeners();
            this.host.remove();
            this.windowsMode = null;
            this.cookieOptions = null;
            this._windowOptions = null;
            this._panels = null;
            this._windows = null;
            this._events = null;
        },

        disable: function () {
            if (!this.disabled) {
                this.disabled = true;
                this._removeEventListeners();
                for (var i = 0; i < this._windows.length; i += 1) {
                    this._windows[i][0].style.opacity = "";
                    $(this._windows[i]).jqxWindow('disable');
                }
            }
        },

        enable: function () {
            if (this.disabled) {
                this.disabled = false;
                this._addEventListeners();
                for (var i = 0; i < this._windows.length; i += 1) {
                    $(this._windows[i]).jqxWindow('enable');
                }
            }
        },

        move: function (window, panel, position) {
            var panel = this._panels[panel];
            if (!panel) {
                return;
            }
            var spacer = $(panel.children('.spacer')), options;
            spacer.detach();
            window = $('#' + window);
            options = this._getWindowOptions(window);
            if (options.mode === 'floating') {
                return;
            } else {
                this._moveWindow(window, panel, position);
            }
            panel.append(spacer);
            this._cookieExporter();
            this._dropFixer(window);
        },

        exportLayout: function () {
            var JSON = '{', fixed = this._exportFixed();
            JSON += fixed.JSON + ',' + this._exportFloating(fixed.children) + ',' + '"orientation": ' + '"' + this.orientation + '"';
            JSON += '}';
            return JSON;
        },

        importLayout: function (JSON) {
            try {
                var imported = $.parseJSON(JSON), order, children;
                this.orientation = imported['orientation'];
                this._performLayout();
                this._importFixed(imported);
                this._importFloating(imported);
            } catch (e) {
                alert('Invalid JSON string.');
            }
        },

        setWindowMode: function (window, mode) {
            var window = $('#' + window),
                options = this._getWindowOptions(window);
            if (mode === 'floating') {
                window.css('position', 'absolute');
                this._windowOptions[window.attr('id')]['mode'] = mode;
            } else {
                if (options.mode === 'floating' &&
                window.css('position') === 'absolute') {
                    if (options.lastPosition) {
                        this._dropDocked(window);
                    } else {
                        this._panels[0].append(window);
                        this._dropFixer(window);
                    }
                }
            }
            this._windowOptions[window.attr('id')]['mode'] = mode;
        },

        hideCloseButton: function (window) {
            $('#' + window).jqxWindow('showCloseButton', false);
        },

        showCloseButton: function (window) {
            $('#' + window).jqxWindow('showCloseButton', true);
        },

        hideCollapseButton: function (window) {
            $('#' + window).jqxWindow('showCollapseButton', false);
        },

        showCollapseButton: function (window) {
            $('#' + window).jqxWindow('showCollapseButton', true);
        },

        expandWindow: function (window, duration) {
            $('#' + window).jqxWindow('expand', duration);
        },

        collapseWindow: function (window, duration) {
            $('#' + window).jqxWindow('collapse', duration);
        },

        setWindowProperty: function (window, propertyName, value) {
            $('#' + window).jqxWindow(propertyName, value);
        },

        getWindowProperty: function (window, propertyName) {
            return $('#' + window).jqxWindow(propertyName);
        },

        setWindowPosition: function (window, x, y) {
            var window = $('#' + window),
                options = this._getWindowOptions(window);
            if (options.mode === 'floating') {
                window.css('position', 'absolute');
                $(window).jqxWindow('move', x, y, null, false);
            }
        },

        hideAllCloseButtons: function () {
            for (var i = 0; i < this._windows.length; i += 1) {
                this._windows[i].jqxWindow('showCloseButton', false);
            }
        },

        hideAllCollapseButtons: function () {
            for (var i = 0; i < this._windows.length; i += 1) {
                this._windows[i].jqxWindow('showCollapseButton', false);
            }
        },

        showAllCloseButtons: function () {
            for (var i = 0; i < this._windows.length; i += 1) {
                this._windows[i].jqxWindow('showCloseButton', true);
            }
        },

        showAllCollapseButtons: function () {
            for (var i = 0; i < this._windows.length; i += 1) {
                this._windows[i].jqxWindow('showCollapseButton', true);
            }
        },

        pinWindow: function (window) {
            $('#' + window).jqxWindow('draggable', false);
        },

        unpinWindow: function (window) {
            $('#' + window).jqxWindow('draggable', true);
        },

        setDraggingMode: function (window) {
            var dockingWindow = $('#' + window);
            this._prepareForDragging(dockingWindow);
            dockingWindow.fadeTo(0, 1);
        },

        enableWindowResize: function (window) {
            window = $('#' + window);
            if (window.css('position') === 'absolute') {
                this._setWindowOption(window, 'resizable', true);
                window.jqxWindow('enableResize', true);
            }
        },

        disableWindowResize: function (window) {
            window = $('#' + window);
            this._setWindowOption(window, 'resizable', false);
            window.jqxWindow('enableResize', false);
        },

        addWindow: function (window, mode, panel, position) {
            var selector = '#' + window;
            $(selector).jqxWindow({ keyboardNavigation: false, rtl: this.rtl, theme: this.theme, enableResize: false, width: $(selector).css('width'), maxWidth: Number.MAX_VALUE });
            this._panels[0].append($(selector));
            this._windows.push($(selector));
            if (mode) {
                this._setWindowOption($(selector), 'mode', mode);
            } else {
                this._setWindowOption($(selector), 'mode', this.mode);
            }
            this._setWindowOption($(selector), 'resizable', true);
            this._setWindowOption($(selector), 'size', { width: $(selector).width(), height: $(selector).height() });
            if (mode == 'floating') {
                $(selector).jqxWindow({ enableResize: true });
            }
            else {
                $(selector).jqxWindow({ enableResize: false });
            }
            if (this._panels[panel] != null) {
                this._setWindowOption($(selector), 'size', { width: this._panels[panel].width(), height: this._panels[panel].height() });
            }

            this._addEventListenersTo($(selector));
            if (typeof panel !== 'undefined' && typeof position !== 'undefined') {
                this.move(window, panel, position);
            }
            this._dropFixer($(selector));
        },

        closeWindow: function (window) {
            $('#' + window).jqxWindow('closeWindow');
        }
    });
})(jqxBaseFramework);
})();



/***/ }),

/***/ 7762:
/***/ (() => {

/* tslint:disable */
/* eslint-disable */
(function () {
    if (typeof document === 'undefined') {
        return;
    }

    (function ($) {
        'use strict';
        $.jqx.jqxWidget('jqxWindow', '', {});

        $.extend($.jqx._jqxWindow.prototype, {

            defineInstance: function () {
                var settings = {
                    // Type: String, Number
                    // Default: auto
                    // Sets or gets window's height.
                    height: 'auto',
                    // Type: Number
                    // Default: 200
                    // Sets or gets window's width.
                    width: 200,
                    // Type: Number
                    // Default: 50
                    // Gets or sets window's minimum height.
                    minHeight: 50,
                    // Type: Number
                    // Default: 1200
                    // Gets or sets window's maximum height.
                    maxHeight: 1200,
                    // Type: Number
                    // Default: 50
                    // Gets or sets window's minimum height.
                    minWidth: 50,
                    // Type: Number
                    // Default: 1200
                    // Gets or sets window's maximum width.
                    maxWidth: 1200,
                    // Type: Bool
                    // Default: true
                    // Gets or sets whether the close button will be shown.
                    showCloseButton: true,
                    // Type: Bool
                    // Default: false
                    // Gets or sets whether the window is disabled.
                    disabled: false,
                    // Type: Bool
                    // Default: true
                    // Sets or gets whether the window will be shown after it's creation.
                    autoOpen: true,
                    // Type: Bool
                    // Default: true
                    // Sets or gets whether the window could be closed with Escape or another keyboard key.
                    keyboardCloseKey: 'esc',
                    // Type: String
                    // Default: ''
                    // Sets or gets window's title.
                    title: '',
                    // Type: String
                    // Default: ''
                    // Sets or gets window's content.
                    content: '',
                    // Type: Bool
                    // Default: true
                    // Sets or gets whether the window is draggale.
                    draggable: true,
                    // Type: Bool
                    // Default: true
                    // Sets or gets whether the window is resizable.
                    resizable: true,
                    // Type: Bool
                    // Default: 'fade'
                    // Sets or gets window's animation type. Possible values ['none', 'fade', 'slide', 'combined']
                    animationType: 'fade',
                    // Type: Number
                    // Default: 250
                    // Sets or gets window's hide animation duration.
                    closeAnimationDuration: 250,
                    // Type: Number
                    // Default: 250
                    // Sets or gets window's show animation duration.
                    showAnimationDuration: 250,
                    // Type: Bool
                    // Default: false
                    // Sets or gets whether the window is modal.
                    isModal: false,
                    // Type: String, Array, Object
                    // Default: 'center'
                    // Sets or gets window's position. Possible values - 'center', 'bottom, left', [232, 45], { x: 42, y: 34 }.
                    position: 'center',
                    // Type: Number
                    // Default: 16
                    // Sets or gets close button's size.
                    closeButtonSize: 16,
                    // Type: String
                    // Default: hide
                    // Sets or gets close button action. Possible values ['hide', 'close']. When closeButtonAction is close we are removing the widget.
                    closeButtonAction: 'hide',
                    // Type: Number
                    // Default: 0.5
                    // Sets or gets modal background's opacity
                    modalOpacity: 0.3,
                    // Type: Object
                    // Default: null
                    // Sets or gets the dragging area. Example { left: 300, top: 300, width: 600, height: 600 }
                    dragArea: null,
                    // Type: Object
                    // Default: null
                    // Sets or gets submit button
                    okButton: null,
                    // Type: Object
                    // Default: null
                    // Sets or gets the cancel button
                    cancelButton: null,
                    // Type: Object
                    // Default: { OK: false, Cancel: false, None: true }
                    // Sets or gets the dialog result
                    dialogResult: { OK: false, Cancel: false, None: true },
                    // Type: Bool
                    // Default: false
                    // Sets or gets whether the window is collapsed
                    collapsed: false,
                    // Type: Bool
                    // Default: true
                    // Sets or gets whether the collapse button is going to be shown
                    showCollapseButton: false,
                    // Type: Number
                    // Default: 150
                    // Sets or gets the collapse animation duration
                    collapseAnimationDuration: 150,
                    // Type: Number
                    // Default: 16
                    // Sets or gets the collapse button size
                    collapseButtonSize: 16,
                    rtl: false,
                    keyboardNavigation: true,
                    headerHeight: null,
                    //To move show into 4th place into the array and to remove open
                    _events: ['created', 'closed', 'moving', 'moved', 'open', 'collapse', 'expand', 'open', 'close', 'resize'],
                    initContent: null,
                    enableResize: true,
                    restricter: null,
                    autoFocus: true,
                    closing: null,
                    _invalidArgumentExceptions: {
                        'invalidHeight': 'Invalid height!',
                        'invalidWidth': 'Invalid width!',
                        'invalidMinHeight': 'Invalid minHeight!',
                        'invalidMaxHeight': 'Invalid maxHeight!',
                        'invalidMinWidth': 'Invalid minWidth!',
                        'invalidMaxWidth': 'Invalid maxWidth',
                        'invalidKeyCode': 'Invalid keyCode!',
                        'invalidAnimationType': 'Invalid animationType!',
                        'invalidCloseAnimationDuration': 'Invalid closeAnimationDuration!',
                        'invalidShowAnimationDuration': 'Invalid showAnimationDuration!',
                        'invalidPosition': 'Invalid position!',
                        'invalidCloseButtonSize': 'Invalid closeButtonSize!',
                        'invalidCollapseButtonSize': 'Invalid collapseButtonSize!',
                        'invalidCloseButtonAction': 'Invalid cluseButtonAction!',
                        'invalidModalOpacity': 'Invalid modalOpacity!',
                        'invalidDragArea': 'Invalid dragArea!',
                        'invalidDialogResult': 'Invalid dialogResult!',
                        'invalidIsModal': 'You can have just one modal window!'
                    },

                    _enableResizeCollapseBackup: null,
                    _enableResizeBackup: undefined,
                    _heightBeforeCollapse: null,
                    _minHeightBeforeCollapse: null,
                    _mouseDown: false,
                    _isDragging: false,
                    _rightContentWrapper: null,
                    _leftContentWrapper: null,
                    _headerContentWrapper: null,
                    _closeButton: null,
                    _collapseButton: null,
                    _title: null,
                    _content: null,
                    _mousePosition: {},
                    _windowPosition: {},
                    _modalBackground: null,
                    _SCROLL_WIDTH: 21,
                    _visible: true,
                    modalBackgroundZIndex: 1299,
                    modalZIndex: 1800,
                    zIndex: 1000,
                    _touchEvents: {
                        'mousedown': $.jqx.mobile.getTouchEventName('touchstart'),
                        'mouseup': $.jqx.mobile.getTouchEventName('touchend'),
                        'mousemove': $.jqx.mobile.getTouchEventName('touchmove'),
                        'mouseenter': 'mouseenter',
                        'mouseleave': 'mouseleave',
                        'click': $.jqx.mobile.getTouchEventName('touchstart')
                    }
                };
                if (this === $.jqx._jqxWindow.prototype) {
                    return settings;
                }
                $.extend(true, this, settings);
                return settings;
            },

            createInstance: function () {
                if (this.host.initAnimate) {
                    this.host.initAnimate();
                }
                this.host.attr('role', 'dialog');
                this.host.removeAttr('data-bind');
                this.host.appendTo(document.body);
                var that = this;

                var sanitizeProperties = function (properties) {
                    for (var i = 0; i < properties.length; i++) {
                        var propertyName = properties[i];
                        if (that[propertyName] && that[propertyName].toString().indexOf('px') >= 0) {
                            that[propertyName] = parseInt(that[propertyName], 10);
                        }
                    }
                };
                sanitizeProperties(['minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'width', 'height']);

                var initRestricter = function () {
                    var paddingTop = parseInt($(that.restricter).css('padding-top'), 10);
                    var paddingLeft = parseInt($(that.restricter).css('padding-left'), 10);
                    var paddingBottom = parseInt($(that.restricter).css('padding-bottom'), 10);
                    var paddingRight = parseInt($(that.restricter).css('padding-right'), 10);

                    var coord = $(that.restricter).coord();
                    that.dragArea = { left: paddingLeft + coord.left, top: paddingTop + coord.top, width: 1 + paddingRight + $(that.restricter).width(), height: 1 + paddingBottom + $(that.restricter).height() };
                };

                if (this.restricter) {
                    initRestricter();
                }

                if (this.restricter) {
                    this.addHandler($(window), 'resize.' + this.element.id, function () {
                        initRestricter();
                    });
                    this.addHandler($(window), 'orientationchanged.' + this.element.id, function () {
                        initRestricter();
                    });
                    this.addHandler($(window), 'orientationchange.' + this.element.id, function () {
                        initRestricter();
                    });
                }

                this._isTouchDevice = $.jqx.mobile.isTouchDevice();
                this._validateProperties();
                this._createStructure();
                this._refresh();
                if (!this.autoOpen) {
                    this.element.style.display = 'none';
                }
                if ($.jqx.browser.msie) {
                    this.host.addClass(this.toThemeProperty('jqx-noshadow'));
                }
                if (!this.isModal) {
                    this._fixWindowZIndex();
                }

                this._setStartupSettings();
                this._positionWindow();
                this._raiseEvent(0);

                if (this.autoOpen) {
                    this._performLayout();
                    var self = this;
                    if (this.isModal) {
                        this._fixWindowZIndex('modal-show');
                    }
                    if (self.initContent) {
                        self.initContent();
                        self._contentInitialized = true;
                    }
                    this._raiseEvent(7);
                    this._raiseEvent(9);
                }
            },

            refresh: function () {
                this._performLayout();
            },

            _setStartupSettings: function () {
                if (this.disabled) {
                    this.disable();
                }
                if (this.collapsed) {
                    this.collapsed = false;
                    this.collapse(0);
                }
                if (!this.autoOpen) {
                    this.hide(null, 0.001, true);
                    this._visible = false;
                }
                if (this.title !== null && this.title !== '') {
                    this.setTitle(this.title);
                }
                if (this.content !== null && this.content !== '') {
                    this.setContent(this.content);
                }
                this.title = this._headerContentWrapper.html();
                this.content = this._content.html();
            },

            //Fixing window's z-index and adding it to the collection of all windows
            //saved in $.data. In the end of the method we are sorting the window list in ascending z-index order.
            _fixWindowZIndex: function (type) {
                var windowsList = $.data(document.body, 'jqxwindows-list') || [], zIndex = this.zIndex;
                if (!this.isModal) {
                    if (this._indexOf(this.host, windowsList) < 0) {
                        windowsList.push(this.host);
                    }
                    $.data(document.body, 'jqxwindows-list', windowsList);
                    if (windowsList.length > 1) {
                        var upperWindow = windowsList[windowsList.length - 2];
                        if (upperWindow.css('z-index') == 'auto') {
                            zIndex = this.zIndex + windowsList.length + 1;
                        }
                        else {
                            var zIndexByProperty = this.zIndex;
                            zIndex = parseInt(upperWindow.css('z-index'), 10) + 1;
                            if (zIndex < zIndexByProperty) {
                                zIndex = zIndexByProperty;
                            }
                        }
                    }
                } else {
                    if (windowsList) {
                        windowsList = this._removeFromArray(this.host, windowsList);
                        $.data(document.body, 'jqxwindows-list', windowsList);
                    }

                    var modalWindows = $.data(document.body, 'jqxwindows-modallist');
                    if (!modalWindows) {
                        if (type == 'modal-show') {
                            var list = [];
                            list.push(this.host);
                            $.data(document.body, 'jqxwindows-modallist', list);
                            modalWindows = list;
                        }
                        else {
                            $.data(document.body, 'jqxwindows-modallist', []);
                            modalWindows = [];
                        }
                    }
                    else {
                        if (type == 'modal-show') {
                            modalWindows.push(this.host);
                        }
                        else {
                            var index = modalWindows.indexOf(this.host);
                            if (index != -1) {
                                modalWindows.splice(index, 1);
                            }
                        }
                    }


                    zIndex = this.modalZIndex;

                    $.each(modalWindows, function () {
                        if (this.data()) {
                            if (this.data().jqxWindow) {
                                var instance = this.data().jqxWindow.instance;
                                instance._modalBackground.style.zIndex = zIndex;
                                instance.element.style.zIndex = zIndex + 1;
                                zIndex += 2;
                            }
                        }
                    });

                    $.data(document.body, 'jqxwindow-modal', this.host);

                    return;
                }
                this.element.style.zIndex = zIndex;
                this._sortByStyle('z-index', windowsList);
            },

            _validateProperties: function () {
                try {
                    this._validateSize();
                    this._validateAnimationProperties();
                    this._validateInteractionProperties();
                    this._validateModalProperties();
                    if (!this.position) {
                        throw new Error(this._invalidArgumentExceptions.invalidPosition);
                    }
                    if (isNaN(this.closeButtonSize) || parseInt(this.closeButtonSize, 10) < 0) {
                        throw new Error(this._invalidArgumentExceptions.invalidCloseButtonSize);
                    }
                    if (isNaN(this.collapseButtonSize) || parseInt(this.collapseButtonSize, 10) < 0) {
                        throw new Error(this._invalidArgumentExceptions.invalidCollapseButtonSize);
                    }
                } catch (exception) {
                    throw new Error(exception);
                }
            },

            _validateModalProperties: function () {
                if (this.modalOpacity < 0 || this.modalOpacity > 1) {
                    throw new Error(this._invalidArgumentExceptions.invalidModalOpacity);
                }
                if (this.isModal && !this._singleModalCheck()) {
                    throw new Error(this._invalidArgumentExceptions.invalidIsModal);
                }
            },

            //If window's height is less than minHeight we are stting height to minHeight the same when the width is less than minWidth.
            //If window's height is greater than maxHeight we are setting height to maxHeight the same with the width.
            _validateSize: function () {
                this._validateSizeLimits();
                if (this.height !== 'auto' && isNaN(parseInt(this.height, 10))) {
                    throw new Error(this._invalidArgumentExceptions.invalidHeight);
                }
                if (this.width !== 'auto' && isNaN(parseInt(this.width, 10))) {
                    throw new Error(this._invalidArgumentExceptions.invalidWidth);
                }
                if (this.height !== 'auto' && this.height < this.minHeight) {
                    this.height = this.minHeight;
                }
                if (this.width < this.minWidth) {
                    this.width = this.minWidth;
                }
                if (this.height !== 'auto' && this.height > this.maxHeight) {
                    this.height = this.maxHeight;
                }
                if (this.width > this.maxWidth) {
                    this.width = this.maxWidth;
                }
                if (this.dragArea === null) {
                    return;
                }
                if (this.dragArea && ((this.dragArea.height !== null && this.host.height() > this.dragArea.height) ||
                    (parseInt(this.height, 10) > this.dragArea.height)) ||
                    (this.dragArea.width !== null && this.width > this.dragArea.width) ||
                    (this.maxHeight > this.dragArea.height || this.maxWidth > this.dragArea.width)) {
                    //throw new Error(this._invalidArgumentExceptions['invalidDragArea']);
                }
            },

            _validateSizeLimits: function () {
                if (this.maxHeight == null) {
                    this.maxHeight = 9999;
                }
                if (this.minWidth == null) {
                    this.minWidth = 0;
                }
                if (this.maxWidth == null) {
                    this.maxWidth = 9999;
                }
                if (this.minHeight == null) {
                    this.minHeight = 0;
                }

                if (isNaN(parseInt(this.minHeight, 10))) {
                    throw new Error(this._invalidArgumentExceptions.invalidMinHeight);
                }
                if (isNaN(parseInt(this.maxHeight, 10))) {
                    throw new Error(this._invalidArgumentExceptions.invalidMaxHeight);
                }
                if (isNaN(parseInt(this.minWidth, 10))) {
                    throw new Error(this._invalidArgumentExceptions.invalidMinWidth);
                }
                if (isNaN(parseInt(this.maxWidth, 10))) {
                    throw new Error(this._invalidArgumentExceptions.invalidMaxWidth);
                }
                if (this.minHeight && this.maxHeight) {
                    if (parseInt(this.minHeight, 10) > parseInt(this.maxHeight, 10) && this.maxHeight != Number.MAX_VALUE) {
                        throw new Error(this._invalidArgumentExceptions.invalidMinHeight);
                    }
                }
                if (this.minWidth && this.maxWidth) {
                    if (parseInt(this.minWidth, 10) > parseInt(this.maxWidth, 10) && this.maxWidth != Number.MAX_VALUE) {
                        throw new Error(this._invalidArgumentExceptions.invalidMinWidth);
                    }
                }
            },

            _validateAnimationProperties: function () {
                if (this.animationType !== 'fade' && this.animationType !== 'slide' && this.animationType !== 'combined' && this.animationType !== 'none') {
                    throw new Error(this._invalidArgumentExceptions.invalidAnimationType);
                }
                if (isNaN(parseInt(this.closeAnimationDuration, 10)) || this.closeAnimationDuration < 0) {
                    throw new Error(this._invalidArgumentExceptions.invalidCloseAnimationDuration);
                }
                if (isNaN(parseInt(this.showAnimationDuration, 10)) || this.showAnimationDuration < 0) {
                    throw new Error(this._invalidArgumentExceptions.invalidShowAnimationDuration);
                }
            },

            _validateInteractionProperties: function () {
                if (parseInt(this.keyCode, 10) < 0 || parseInt(this.keyCode, 10) > 130 && this.keyCode !== 'esc') {
                    throw new Error(this._invalidArgumentExceptions.invalidKeyCode);
                }
                if (this.dragArea !== null && (typeof this.dragArea.width === 'undefined' ||
                    typeof this.dragArea.height === 'undefined' || typeof this.dragArea.left === 'undefined' || typeof this.dragArea.top === 'undefined')) {
                    throw new Error(this._invalidArgumentExceptions.invalidDragArea);
                }
                if (!this.dialogResult || (!this.dialogResult.OK && !this.dialogResult.Cancel && !this.dialogResult.None)) {
                    throw new Error(this._invalidArgumentExceptions.invalidDialogResult);
                }
                if (this.closeButtonAction !== 'hide' && this.closeButtonAction !== 'close') {
                    throw new Error(this._invalidArgumentExceptions.invalidCloseButtonAction);
                }
            },

            _singleModalCheck: function () {
                var windowsList = $.data(document.body, 'jqxwindows-list') || [],
                    count = windowsList.length;
                while (count) {
                    count -= 1;
                    if ($(windowsList[count].attr('id')).length > 0) {
                        if ($(windowsList[count].attr('id')).jqxWindow('isModal')) {
                            return false;
                        }
                    }
                }
                return true;
            },

            //This method is constructing the window from two type's of structures.
            //The first one is containing two divs. The first one is window's host and contain 'caption' attribute. The second
            //div is window's content.
            //The second one is containing three divs. The first one is representing the window. Second one (first inner)
            //window's header and the third one window's content.
            _createStructure: function () {
                var children = this.host.children();
                if (children.length === 1) {
                    this._content = children[0];
                    this._header = document.createElement('div');
                    this._header.innerHTML = this.host.attr('caption');
                    this.element.insertBefore(this._header, this._content);
                    this.host.attr('caption', '');
                    this._header = $(this._header);
                    this._content = $(this._content);
                } else if (children.length === 2) {
                    this._header = $(children[0]);
                    this._content = $(children[1]);
                } else {
                    throw new Error('Invalid structure!');
                }
            },

            _refresh: function () {
                this._render();
                this._addStyles();
                this._performLayout();
                this._removeEventHandlers();
                this._addEventHandlers();
                this._initializeResize();
            },

            _render: function () {
                this._addHeaderWrapper();
                this._addCloseButton();
                this._addCollapseButton();
                this._removeModal();
                this._makeModal();
            },

            _addHeaderWrapper: function () {
                if (!this._headerContentWrapper) {
                    this._header[0].innerHTML = '<div style="float:left;">' + this._header[0].innerHTML + '</div>';
                    this._headerContentWrapper = $(this._header.children()[0]);
                    if (this.headerHeight !== null) {
                        this._header.height(this.headerHeight);
                    }
                }
            },

            _addCloseButton: function () {
                if (!this._closeButton) {
                    // the wrapper's purpose is to be a background of the close button's image.
                    this._closeButtonWrapper = document.createElement('div');
                    this._closeButtonWrapper.className = this.toThemeProperty('jqx-window-close-button-background');
                    this._closeButton = document.createElement('div');
                    this._closeButton.className = this.toThemeProperty('jqx-window-close-button jqx-icon-close');
                    this._closeButton.style.width = '100%';
                    this._closeButton.style.height = '100%';
                    this._closeButtonWrapper.appendChild(this._closeButton);
                    this._header[0].appendChild(this._closeButtonWrapper);

                    this._closeButtonWrapper = $(this._closeButtonWrapper);
                    this._closeButton = $(this._closeButton);
                }
            },

            _addCollapseButton: function () {
                if (!this._collapseButton) {
                    // the wrapper's purpose is to be a background of the close button's image.
                    this._collapseButtonWrapper = document.createElement('div');
                    this._collapseButtonWrapper.className = this.toThemeProperty('jqx-window-collapse-button-background');
                    this._collapseButton = document.createElement('div');
                    this._collapseButton.className = this.toThemeProperty('jqx-window-collapse-button jqx-icon-arrow-up');
                    this._collapseButton.style.width = '100%';
                    this._collapseButton.style.height = '100%';
                    this._collapseButtonWrapper.appendChild(this._collapseButton);
                    this._header[0].appendChild(this._collapseButtonWrapper);

                    this._collapseButtonWrapper = $(this._collapseButtonWrapper);
                    this._collapseButton = $(this._collapseButton);
                }
            },

            _removeModal: function () {
                if (!this.isModal && typeof this._modalBackground === 'object' && this._modalBackground !== null) {
                    $('.' + this.toThemeProperty('jqx-window-modal')).remove();
                    this._modalBackground = null;
                }
            },

            focus: function () {
                try {
                    this.host.focus();
                    var me = this;
                    setTimeout(function () {
                        me.host.focus();
                    }, 10);
                }
                catch (error) {
                }
            },

            _makeModal: function () {
                if (this.isModal && !this._modalBackground) {
                    var windows = $.data(document.body, 'jqxwindows-list');
                    if (windows) {
                        this._removeFromArray(this.host, windows);
                        $.data(document.body, 'jqxwindows-list', windows);
                    }
                    this._modalBackground = document.createElement('div');
                    this._modalBackground.className = this.toThemeProperty('jqx-window-modal');
                    this._setModalBackgroundStyles();
                    document.body.appendChild(this._modalBackground);
                    this.addHandler(this._modalBackground, this._getEvent('click'), function () {
                        return false;
                    });
                    var me = this;
                    var ischildof = function (element, filterString) {
                        return filterString.contains(element);
                    };

                    this.addHandler(this._modalBackground, 'mouseup', function (event) {
                        me._stopResizing(me);
                        event.preventDefault();
                        //     return false;
                    });
                    this.addHandler(this._modalBackground, 'mousedown', function (event) {
                        var tabbables = me._getTabbables();
                        if (tabbables.length > 0) {
                            tabbables[0].focus();
                            setTimeout(function () {
                                tabbables[0].focus();
                            }, 100);
                        }

                        event.preventDefault();
                        return false;
                    });

                    this.addHandler($(document), 'keydown.window' + this.element.id, function (event) {
                        if (event.keyCode !== 9) {
                            return;
                        }

                        var modalWindows = $.data(document.body, 'jqxwindows-modallist');
                        if (modalWindows.length > 1) {
                            if (modalWindows[modalWindows.length - 1][0] != me.element) {
                                return;
                            }
                        }

                        var tabbables = me._getTabbables();
                        var first = null;
                        var last = null;

                        if (me.element.offsetWidth === 0 || me.element.offsetHeight === 0) {
                            return;
                        }

                        if (tabbables.length > 0) {
                            first = tabbables[0];
                            last = tabbables[tabbables.length - 1];
                        }

                        if (event.target == me.element) {
                            return;
                        }

                        if (first == null) {
                            return;
                        }

                        if (!ischildof(event.target, me.element)) {
                            first.focus();
                            return false;
                        }

                        if (event.target === last && !event.shiftKey) {
                            first.focus();
                            return false;
                        } else if (event.target === first && event.shiftKey) {
                            last.focus();
                            return false;
                        }
                    });
                }
            },

            _addStyles: function () {
                this.host.addClass(this.toThemeProperty('jqx-rc-all'));
                this.host.addClass(this.toThemeProperty('jqx-window'));
                this.host.addClass(this.toThemeProperty('jqx-popup'));
                if ($.jqx.browser.msie) {
                    this.host.addClass(this.toThemeProperty('jqx-noshadow'));
                }
                this.host.addClass(this.toThemeProperty('jqx-widget'));
                this.host.addClass(this.toThemeProperty('jqx-widget-content'));
                this._header.addClass(this.toThemeProperty('jqx-window-header'));
                this._content.addClass(this.toThemeProperty('jqx-window-content'));
                this._header.addClass(this.toThemeProperty('jqx-widget-header'));
                this._content.addClass(this.toThemeProperty('jqx-widget-content'));
                this._header.addClass(this.toThemeProperty('jqx-disableselect'));
                this._header.addClass(this.toThemeProperty('jqx-rc-t'));
                this._content.addClass(this.toThemeProperty('jqx-rc-b'));
                if (!this.host.attr('tabindex')) {
                    this.element.tabIndex = 0;
                    this._header[0].tabIndex = 0;
                    this._content[0].tabIndex = 0;
                }
                this.element.setAttribute('hideFocus', 'true');
                this.element.style.outline = 'none';
            },

            _performHeaderLayout: function () {
                this._handleHeaderButtons();
                this._header[0].style.position = 'relative';
                if (this.rtl) {
                    this._headerContentWrapper[0].style.direction = 'rtl';
                    this._headerContentWrapper[0].style['float'] = 'right';
                } else {
                    this._headerContentWrapper[0].style.direction = 'ltr';
                    this._headerContentWrapper[0].style['float'] = 'left';
                }

                this._performHeaderCloseButtonLayout();
                this._performHeaderCollapseButtonLayout();

                this._centerElement(this._headerContentWrapper, this._header, 'y', 'margin');
                if (this.headerHeight) {
                    this._centerElement(this._closeButtonWrapper, this._header, 'y', 'margin');
                    this._centerElement(this._collapseButtonWrapper, this._header, 'y', 'margin');
                }
            },

            _handleHeaderButtons: function () {
                if (!this._closeButtonWrapper) {
                    return;
                }

                if (!this.showCloseButton) {
                    this._closeButtonWrapper[0].style.visibility = 'hidden';
                } else {
                    this._closeButtonWrapper[0].style.visibility = 'visible';
                    var closeButtonSize = this._toPx(this.closeButtonSize);
                    this._closeButtonWrapper[0].style.width = closeButtonSize;
                    this._closeButtonWrapper[0].style.height = closeButtonSize;
                }
                if (!this.showCollapseButton) {
                    this._collapseButtonWrapper[0].style.visibility = 'hidden';
                } else {
                    this._collapseButtonWrapper[0].style.visibility = 'visible';
                    var collapseButtonSize = this._toPx(this.collapseButtonSize);
                    this._collapseButtonWrapper[0].style.width = collapseButtonSize;
                    this._collapseButtonWrapper[0].style.height = collapseButtonSize;
                }
            },

            _performHeaderCloseButtonLayout: function () {
                if (!this._closeButtonWrapper) {
                    return;
                }

                var paddingRight = parseInt(this._header.css('padding-right'), 10);
                if (!isNaN(paddingRight)) {
                    this._closeButtonWrapper.width(this._closeButton.width());
                    if (!this.rtl) {
                        this._closeButtonWrapper[0].style.marginRight = this._toPx(paddingRight);
                        this._closeButtonWrapper[0].style.marginLeft = '0px';
                    } else {
                        this._closeButtonWrapper[0].style.marginRight = '0px';
                        this._closeButtonWrapper[0].style.marginLeft = this._toPx(paddingRight);
                    }
                }
                this._closeButtonWrapper[0].style.position = 'absolute';
                if (!this.rtl) {
                    this._closeButtonWrapper[0].style.right = '0px';
                    this._closeButtonWrapper[0].style.left = '';
                } else {
                    this._closeButtonWrapper[0].style.right = '';
                    this._closeButtonWrapper[0].style.left = '0px';
                }
            },

            _performHeaderCollapseButtonLayout: function () {
                if (!this._closeButtonWrapper) {
                    return;
                }
                var paddingRight = parseInt(this._header.css('padding-right'), 10);
                if (!isNaN(paddingRight)) {
                    var collapseButtonSize = this._toPx(this.collapseButtonSize);
                    this._collapseButtonWrapper[0].style.width = collapseButtonSize;
                    this._collapseButtonWrapper[0].style.height = collapseButtonSize;
                    if (!this.rtl) {
                        this._collapseButtonWrapper[0].style.marginRight = this._toPx(paddingRight);
                        this._collapseButtonWrapper[0].style.marginLeft = '0px';
                    } else {
                        this._collapseButtonWrapper[0].style.marginRight = '0px';
                        this._collapseButtonWrapper[0].style.marginLeft = this._toPx(paddingRight);
                    }
                }
                this._collapseButtonWrapper[0].style.position = 'absolute';
                var rightLeft = this._toPx(this.showCloseButton ? this._closeButton.outerWidth(true) : 0);
                if (!this.rtl) {
                    this._collapseButtonWrapper[0].style.right = rightLeft;
                    this._collapseButtonWrapper[0].style.left = '';
                } else {
                    this._collapseButtonWrapper[0].style.right = '';
                    this._collapseButtonWrapper[0].style.left = rightLeft;
                }

                this._centerElement(this._collapseButton, $(this._collapseButton[0].parentElement), 'y');
            },

            _performWidgetLayout: function () {
                var isValid;
                if (this.width !== 'auto') {
                    if (this.width && this.width.toString().indexOf('%') >= 0) {
                        this.element.style.width = this.width;
                    }
                    else {
                        this.element.style.width = this._toPx(this.width);
                    }
                }
                if (!this.collapsed) {
                    if (this.height !== 'auto') {
                        if (this.height && this.height.toString().indexOf('%') >= 0) {
                            this.element.style.height = this.height;
                        }
                        else {
                            this.element.style.height = this._toPx(this.height);
                        }
                    } else {
                        this.element.style.height = this.host.height() + 'px';
                    }
                    this.element.style.minHeight = this._toPx(this.minHeight);
                }
                this._setChildrenLayout();
                isValid = this._validateMinSize();
                this.element.style.maxHeight = this._toPx(this.maxHeight);
                this.element.style.minWidth = this._toPx(this.minWidth);
                this.element.style.maxWidth = this._toPx(this.maxWidth);
                if (!isValid) {
                    this._setChildrenLayout();
                }
            },

            _setChildrenLayout: function () {
                this._header.width(this.host.width() - (this._header.outerWidth(true) - this._header.width()));
                this._content.width(this.host.width() - (this._content.outerWidth(true) - this._content.width()));
                this._content.height(this.host.height() - this._header.outerHeight(true) - (this._content.outerHeight(true) - this._content.height()));
            },

            _validateMinSize: function () {
                var returnValue = true;
                if (this.minHeight < this._header.height()) {
                    this.minHeight = this._header.height();
                    returnValue = false;
                }
                var headerContentWidth = $(this._header.children()[0]).outerWidth(),
                    closeButtonWidth = this._header.children()[1] ? $(this._header.children()[1]).outerWidth() : 0,
                    headerInnerWidth = headerContentWidth + closeButtonWidth;
                if (this.minWidth < 100) {
                    this.minWidth = Math.min(headerInnerWidth, 100);
                    returnValue = false;
                }
                return returnValue;
            },

            _centerElement: function (child, parent, axis, attribute) {
                if (typeof parent.left === 'number' && typeof parent.top === 'number' &&
                    typeof parent.height === 'number' && typeof parent.width === 'number') {
                    this._centerElementInArea(child, parent, axis);
                } else {
                    this._centerElementInParent(child, parent, axis, attribute);
                }
            },

            _centerElementInParent: function (child, parent, axis, attribute) {
                var hiddenChild = child.css('display') === 'none';
                var cssPropertyY, cssPropertyX;
                axis = axis.toLowerCase();
                if (attribute) {
                    cssPropertyY = attribute + 'Top';
                    cssPropertyX = attribute + 'Left';
                } else {
                    cssPropertyY = 'top';
                    cssPropertyX = 'left';
                }
                if (axis.indexOf('y') >= 0) {
                    if (hiddenChild) {
                        child[0].style.display = 'block';
                    }
                    var childHeight = child.outerHeight(true),
                        parentHeight;
                    if (hiddenChild) {
                        child[0].style.display = 'none';
                    }

                    parentHeight = parent.height();
                    var verticalDisplacement = (Math.max(0, parentHeight - childHeight)) / 2;

                    child[0].style[cssPropertyY] = verticalDisplacement + 'px';
                }
                if (axis.indexOf('x') >= 0) {
                    if (hiddenChild) {
                        child[0].style.display = 'block';
                    }
                    var childWidth = child.outerWidth(true),
                        parentWidth;
                    if (hiddenChild) {
                        child[0].style.display = 'none';
                    }

                    parentWidth = parent.width();
                    var horizontalDisplacement = (Math.max(0, parentWidth - childWidth)) / 2;
                    child[0].style[cssPropertyX] = horizontalDisplacement + 'px';
                }
            },

            _centerElementInArea: function (child, area, axis) {
                axis = axis.toLowerCase();
                if (axis.indexOf('y') >= 0) {
                    var childHeight = child.outerHeight(true);
                    var parentHeight = area.height;
                    var verticalDisplacement = (parentHeight - childHeight) / 2;
                    child[0].style.top = verticalDisplacement + area.top + 'px';
                }
                if (axis.indexOf('x') >= 0) {
                    var childWidth = child.outerWidth(true);
                    var parentWidth = area.width;
                    var horizontalDisplacement = (parentWidth - childWidth) / 2;
                    child[0].style.left = horizontalDisplacement + area.left + 'px';
                }
            },

            _removeEventHandlers: function () {
                this.removeHandler(this._header, this._getEvent('mousedown'));
                this.removeHandler(this._header, this._getEvent('mousemove'));
                this.removeHandler(this._header, 'focus');
                this.removeHandler($(document), this._getEvent('mousemove') + '.' + this.host.attr('id'));
                this.removeHandler($(document), this._getEvent('mouseup') + '.' + this.host.attr('id'));
                this.removeHandler(this.host, 'keydown');
                this.removeHandler(this._closeButton, this._getEvent('click'));
                this.removeHandler(this._closeButton, this._getEvent('mouseenter'));
                this.removeHandler(this._closeButton, this._getEvent('mouseleave'));
                this.removeHandler(this._collapseButton, this._getEvent('click'));
                this.removeHandler(this._collapseButton, this._getEvent('mouseenter'));
                this.removeHandler(this._collapseButton, this._getEvent('mouseleave'));
                this.removeHandler(this.host, this._getEvent('mousedown'));
                if (this.okButton) {
                    this.removeHandler($(this.okButton), this._getEvent('click'), this._setDialogResultHandler);
                }
                if (this.cancelButton) {
                    this.removeHandler($(this.cancelButton), this._getEvent('click'), this._setDialogResultHandler);
                }
                this.removeHandler(this._header, this._getEvent('mouseenter'));
                this.removeHandler(this._header, this._getEvent('mouseleave'));
                this.removeHandler(this.host, 'resizing', this._windowResizeHandler);
            },

            _removeFromArray: function (element, array) {
                var indexOfElement = this._indexOf(element, array);
                if (indexOfElement >= 0) {
                    return array.splice(this._indexOf(element, array), 1);
                } else {
                    return array;
                }
            },

            _sortByStyle: function (attr, collection) {
                for (var i = 0; i < collection.length; i++) {
                    for (var j = collection.length - 1; j > i; j--) {
                        var itemOne = collection[j], itemTwo = collection[j - 1], tmp;
                        if (parseInt(itemOne.css(attr), 10) < parseInt(itemTwo.css(attr), 10)) {
                            tmp = itemOne;
                            collection[j] = itemTwo;
                            collection[j - 1] = tmp;
                        }
                    }
                }
            },

            _initializeResize: function () {
                if (this.resizable) {
                    var self = this;
                    this.initResize({
                        target: this.host,
                        alsoResize: self._content,
                        maxWidth: self.maxWidth,
                        minWidth: self.minWidth,
                        maxHeight: self.maxHeight,
                        minHeight: self.minHeight,
                        indicatorSize: 10,
                        resizeParent: self.dragArea
                    });
                }
            },

            _removeResize: function () {
                this.removeResize();
            },

            _getEvent: function (event) {
                if (this._isTouchDevice) {
                    return this._touchEvents[event];
                } else {
                    return event;
                }
            },

            _addEventHandlers: function () {
                this._addDragDropHandlers();
                this._addCloseHandlers();
                this._addCollapseHandlers();
                this._addFocusHandlers();
                this._documentResizeHandlers();
                this._closeButtonHover();
                this._collapseButtonHover();
                this._addDialogButtonsHandlers();
                this._addHeaderHoverEffect();
                this._addResizeHandlers();
                var me = this;
                this.addHandler(this._header, this._getEvent('mousemove'), function () {
                    me._addHeaderCursorHandlers(me);
                }
                );
            },

            _addResizeHandlers: function () {
                var that = this;
                that.addHandler(that.host, 'resizing', that._windowResizeHandler, { self: that });
                this.addHandler($(window), 'orientationchanged.' + this.element.id, function () {
                    that._performLayout();
                });
                this.addHandler($(window), 'orientationchange.' + this.element.id, function () {
                    that._performLayout();
                });
            },

            _windowResizeHandler: function (event) {
                var self = event.data.self;
                self._header.width(self.host.width() - (self._header.outerWidth(true) - self._header.width()));
                if (self.width && self.width.toString().indexOf('%') >= 0) {
                    var onePercent = $(document.body).width() / 100;
                    var onePixelToPercentage = 1 / onePercent; // one pixel is equal to this amount of percentages.

                    self.width = (onePixelToPercentage * event.args.width) + '%';
                }
                else {
                    self.width = event.args.width;
                }

                if (self.height && self.height.toString().indexOf('%') >= 0) {
                    var onePercent = $(document.body).height() / 100;
                    var onePixelToPercentage = 1 / onePercent; // one pixel is equal to this amount of percentages.

                    self.height = (onePixelToPercentage * event.args.height) + '%';
                }
                else {
                    self.height = event.args.height;
                }

            },

            _addHeaderHoverEffect: function () {
                var self = this;
                this.addHandler(this._header, this._getEvent('mouseenter'), function () {
                    $(this).addClass(self.toThemeProperty('jqx-window-header-hover'));
                });
                this.addHandler(this._header, this._getEvent('mouseleave'), function () {
                    $(this).removeClass(self.toThemeProperty('jqx-window-header-hover'));
                });
            },

            _addDialogButtonsHandlers: function () {
                if (this.okButton) {
                    this.addHandler($(this.okButton), this._getEvent('click'), this._setDialogResultHandler, { self: this, result: 'ok' });
                }
                if (this.cancelButton) {
                    this.addHandler($(this.cancelButton), this._getEvent('click'), this._setDialogResultHandler, { self: this, result: 'cancel' });
                }
            },

            _documentResizeHandlers: function () {
                var self = this;
                if (this.isModal) {
                    this.addHandler($(window), 'resize.window' + this.element.id, function () {
                        if (typeof self._modalBackground === 'object' && self._modalBackground !== null) {
                            if (self.isOpen()) {
                                self._modalBackground.style.display = 'none';
                            }
                            if (!self.restricter) {
                                var documentSize = self._getDocumentSize();
                                self._modalBackground.style.width = documentSize.width + 'px';
                                self._modalBackground.style.height = documentSize.height + 'px';
                            }
                            else {
                                self._modalBackground.style.left = self._toPx(self.dragArea.left);
                                self._modalBackground.style.top = self._toPx(self.dragArea.top);
                                self._modalBackground.style.width = self._toPx(self.dragArea.width);
                                self._modalBackground.style.height = self._toPx(self.dragArea.height);
                            }

                            if (self.isOpen()) {
                                self._modalBackground.style.display = 'block';
                            }
                        }
                    });
                }
            },

            _setDialogResultHandler: function (event) {
                var self = event.data.self;
                self._setDialogResult(event.data.result);
                self.closeWindow();
            },

            _setDialogResult: function (result) {
                this.dialogResult.OK = false;
                this.dialogResult.None = false;
                this.dialogResult.Cancel = false;
                result = result.toLowerCase();
                switch (result) {
                    case 'ok':
                        this.dialogResult.OK = true;
                        break;
                    case 'cancel':
                        this.dialogResult.Cancel = true;
                        break;
                    default:
                        this.dialogResult.None = true;
                }
            },

            _getDocumentSize: function () {
                var isIEBefore9 = $.jqx.browser.msie && $.jqx.browser.version < 9;
                var scrollTop = isIEBefore9 ? 4 : 0;
                var scrollLeft = scrollTop;
                if (document.body.scrollHeight > document.body.clientHeight && isIEBefore9) {
                    scrollTop = this._SCROLL_WIDTH;
                }
                if (document.body.scrollWidth > document.body.clientWidth && isIEBefore9) {
                    scrollLeft = this._SCROLL_WIDTH;
                }

                return { width: $(document).width() - scrollTop, height: $(document).height() - scrollLeft };
            },

            _closeButtonHover: function () {
                var self = this;
                this.addHandler(this._closeButton, this._getEvent('mouseenter'), function () {
                    self._closeButton.addClass(self.toThemeProperty('jqx-window-close-button-hover'));
                });
                this.addHandler(this._closeButton, this._getEvent('mouseleave'), function () {
                    self._closeButton.removeClass(self.toThemeProperty('jqx-window-close-button-hover'));
                });
            },

            _collapseButtonHover: function () {
                var self = this;
                this.addHandler(this._collapseButton, this._getEvent('mouseenter'), function () {
                    self._collapseButton.addClass(self.toThemeProperty('jqx-window-collapse-button-hover'));
                });
                this.addHandler(this._collapseButton, this._getEvent('mouseleave'), function () {
                    self._collapseButton.removeClass(self.toThemeProperty('jqx-window-collapse-button-hover'));
                });
            },

            _setModalBackgroundStyles: function () {
                if (this.isModal) {
                    var documentSize = this._getDocumentSize();
                    if (!($.jqx.browser.msie && $.jqx.browser.version < 9)) {
                        this._modalBackground.style.opacity = this.modalOpacity;
                    } else {
                        this._modalBackground.style.filter = 'alpha(opacity=' + (this.modalOpacity * 100) + ')';
                    }
                    this._modalBackground.style.position = 'absolute';
                    this._modalBackground.style.top = '0px';
                    this._modalBackground.style.left = '0px';
                    this._modalBackground.style.width = documentSize.width;
                    this._modalBackground.style.height = documentSize.height;
                    this._modalBackground.style.zIndex = this.modalBackgroundZIndex;
                    if (!this.autoOpen) {
                        this._modalBackground.style.display = 'none';
                    }
                }
            },

            _addFocusHandlers: function () {
                var self = this;
                this.addHandler(this.host, this._getEvent('mousedown'), function () {
                    if (!self.isModal) {
                        self.bringToFront();
                    }
                });
            },

            _indexOf: function (host, collection) {
                for (var i = 0; i < collection.length; i++) {
                    if (collection[i][0] === host[0]) {
                        return i;
                    }
                }
                return -1;
            },

            _addCloseHandlers: function () {
                var self = this;
                this.addHandler(this._closeButton, this._getEvent('click'), function (event) {
                    return self._closeWindow(event);
                }
                );
                if (this.keyboardCloseKey !== 'none') {
                    if (typeof this.keyboardCloseKey !== 'number' && this.keyboardCloseKey.toLowerCase() === 'esc') {
                        this.keyboardCloseKey = 27;
                    }
                }
                this.addHandler(this.host, 'keydown', function (event) {
                    if (event.keyCode === self.keyboardCloseKey && self.keyboardCloseKey != null && self.keyboardCloseKey != 'none') {
                        self._closeWindow(event);
                    } else {
                        self._handleKeys(event);
                    }
                }, { self: this });

                this.addHandler(this.host, 'keyup', function () {
                    if (!self.keyboardNavigation) {
                        return;
                    }

                    if (self._moved) {
                        var offset = self.host.coord();
                        var left = offset.left;
                        var top = offset.top;
                        self._raiseEvent(3, left, top, left, top);
                        self._moved = false;
                    }
                });
            },

            _handleKeys: function (event) {
                if (!this.keyboardNavigation) {
                    return;
                }
                if (!this._headerFocused) {
                    return;
                }
                if ($(document.activeElement).ischildof(this._content)) {
                    return;
                }

                var ctrl = event.ctrlKey;
                var key = event.keyCode;
                var offset = this.host.coord();
                var left = offset.left;
                var top = offset.top;
                var area = this._getDraggingArea();
                var width = this.host.width();
                var height = this.host.height();
                var result = true;
                var step = 10;

                switch (key) {
                    case 37:
                        if (!ctrl) {
                            if (this.draggable) {
                                if (left - step >= 0) {
                                    this.move(left - step, top);
                                }
                            }
                        }
                        else {
                            if (this.resizable) {
                                this.resize(width - step, height);
                            }
                        }
                        result = false;
                        break;
                    case 38:
                        if (!ctrl) {
                            if (this.draggable) {
                                if (top - step >= 0) {
                                    this.move(left, top - step);
                                }
                            }
                        }
                        else {
                            if (this.resizable) {
                                this.resize(width, height - step);
                            }
                        }
                        result = false;
                        break;
                    case 39:
                        if (!ctrl) {
                            if (this.draggable) {
                                if (left + width + step <= area.width) {
                                    this.move(left + step, top);
                                }
                            }
                        }
                        else {
                            if (this.resizable) {
                                this.resize(width + step, height);
                            }
                        }
                        result = false;
                        break;
                    case 40:
                        if (!ctrl) {
                            if (this.draggable) {
                                if (top + height + step <= area.height) {
                                    this.move(left, top + step);
                                }
                            }
                        }
                        else {
                            if (this.resizable) {
                                this.resize(width, height + step);
                            }
                        }
                        result = false;
                        break;
                }
                if (!result) {
                    if (event.preventDefault) {
                        event.preventDefault();
                    }
                    if (event.stopPropagation) {
                        event.stopPropagation();
                    }
                }

                return result;
            },

            _addCollapseHandlers: function () {
                var self = this;
                this.addHandler(this._collapseButton, this._getEvent('click'), function () {
                    if (!self.collapsed) {
                        self.collapse();
                    } else {
                        self.expand();
                    }
                });
            },

            _closeWindow: function () {
                this.closeWindow();
                return false;
            },

            _addHeaderCursorHandlers: function (self) {
                if (self.resizeArea && self.resizable && !self.collapsed) {
                    self._header[0].style.cursor = self._resizeWrapper.style.cursor;
                    return;
                } else if (self.draggable) {
                    self._header[0].style.cursor = 'move';
                    return;
                }
                self._header[0].style.cursor = 'default';
                if (self._resizeWrapper) {
                    self._resizeWrapper.style.cursor = 'default';
                }
            },

            _addDragDropHandlers: function () {
                if (this.draggable) {
                    var self = this;
                    this.addHandler(this.host, 'focus', function () {
                        self._headerFocused = true;
                    });

                    this.addHandler(this.host, 'blur', function () {
                        self._headerFocused = false;
                    });

                    this.addHandler(this._header, 'focus', function () {
                        self._headerFocused = true;
                        return false;
                    });

                    this.addHandler(this._header, this._getEvent('mousedown'), function (event, x, y) {
                        if (x) {
                            event.pageX = x;
                        }
                        if (y) {
                            event.pageY = y;
                        }
                        self._headerMouseDownHandler(self, event);
                        return true;
                    });

                    this.addHandler(this._header, 'dragstart', function (event) {
                        if (event.preventDefault) {
                            event.preventDefault();
                        }
                        return false;
                    });

                    this.addHandler(this._header, this._getEvent('mousemove'), function (event) {
                        return self._headerMouseMoveHandler(self, event);
                    });

                    this.addHandler($(document), this._getEvent('mousemove') + '.' + this.host.attr('id'), function (event) {
                        return self._dragHandler(self, event);
                    });
                    this.addHandler($(document), this._getEvent('mouseup') + '.' + this.host.attr('id'), function (event) {
                        return self._dropHandler(self, event);
                    });

                    try {
                        if (document.referrer !== '' || window.frameElement) {
                            var parentLocation = null;
                            if (window.top != null && window.top != window.self) {
                                if (window.parent && document.referrer) {
                                    parentLocation = document.referrer;
                                }
                            }

                            if (parentLocation && parentLocation.indexOf(document.location.host) != -1) {
                                var eventHandle = function (event) {
                                    self._dropHandler(self, event);
                                };

                                if (window.top.document.addEventListener) {
                                    window.top.document.addEventListener('mouseup', eventHandle, false);

                                } else if (window.top.document.attachEvent) {
                                    window.top.document.attachEvent('onmouseup', eventHandle);
                                }
                            }
                        }
                    }
                    catch (error) {
                    }
                }
            },

            _headerMouseDownHandler: function (self, event) {
                if (!self.isModal) {
                    self.bringToFront();
                }
                if (self._resizeDirection == null) {
                    var position = $.jqx.position(event);
                    self._mousePosition.x = position.left;
                    self._mousePosition.y = position.top;
                    self._mouseDown = true;
                    self._isDragging = false;
                }
            },

            _headerMouseMoveHandler: function (self, event) {
                if (self._mouseDown && !self._isDragging) {
                    var touches = $.jqx.mobile.getTouches(event);
                    var touch = touches[0];

                    var pageX = touch.pageX,
                        pageY = touch.pageY;
                    var position = $.jqx.position(event);
                    pageX = position.left;
                    pageY = position.top;

                    if ((pageX + 3 < self._mousePosition.x || pageX - 3 > self._mousePosition.x) ||
                        (pageY + 3 < self._mousePosition.y || pageY - 3 > self._mousePosition.y)) {
                        self._isDragging = true;
                        self._mousePosition = { x: pageX, y: pageY };
                        //self._windowPosition = { x: parseInt(self.host.css('left'), 10), y: parseInt(self.host.css('top'), 10) };
                        self._windowPosition = { x: self.host.coord().left, y: self.host.coord().top };
                        $(document.body).addClass(self.toThemeProperty('jqx-disableselect'));
                    }
                    if (self._isTouchDevice) {
                        event.preventDefault();
                        return true;
                    }
                    return false;
                }
                if (self._isDragging) {
                    if (self._isTouchDevice) {
                        event.preventDefault();
                        return true;
                    }
                    return false;
                }
                return true;
            },

            _dropHandler: function (self, event) {
                var result = true;
                if (self._isDragging && !self.isResizing && !self._resizeDirection) {
                    var x = parseInt(self.host.css('left'), 10),
                        y = parseInt(self.host.css('top'), 10),
                        pageX = (self._isTouchDevice) ? 0 : event.pageX,
                        pageY = (self._isTouchDevice) ? 0 : event.pageY;
                    self.enableResize = self._enableResizeBackup;
                    self._enableResizeBackup = 'undefined';
                    self._raiseEvent(3, x, y, pageX, pageY);
                    result = false;

                    if (event.preventDefault != 'undefined') {
                        event.preventDefault();
                    }

                    if (event.originalEvent != null) {
                        event.originalEvent.mouseHandled = true;
                    }

                    if (event.stopPropagation != 'undefined') {
                        event.stopPropagation();
                    }
                }
                self._isDragging = false;
                self._mouseDown = false;
                $(document.body).removeClass(self.toThemeProperty('jqx-disableselect'));
                return result;
            },

            _dragHandler: function (self, event) {
                if (self._isDragging && !self.isResizing && !self._resizeDirection) {
                    var eventWhich = (self._isTouchDevice) ? event.originalEvent.which : event.which;
                    if (typeof self._enableResizeBackup === 'undefined') {
                        self._enableResizeBackup = self.enableResize;
                    }
                    self.enableResize = false;
                    if (eventWhich === 0 && $.jqx.browser.msie && $.jqx.browser.version < 8) {
                        return self._dropHandler(self, event);
                    }
                    var position = $.jqx.position(event);

                    var pageX = position.left,
                        pageY = position.top,
                        displacementX = pageX - self._mousePosition.x,
                        displacementY = pageY - self._mousePosition.y,
                        newX = self._windowPosition.x + displacementX,
                        newY = self._windowPosition.y + displacementY;
                    self.move(newX, newY, event);
                    event.preventDefault();
                    return false;
                }
                return true;
            },

            _validateCoordinates: function (x, y, scrollTop, scrollLeft) {
                var dragArea = this._getDraggingArea();
                x = (x < dragArea.left) ? dragArea.left : x;
                y = (y < dragArea.top) ? dragArea.top : y;
                var hostwidth = this.host.outerWidth(true);
                var hostheight = this.host.outerHeight(true);
                if (x + hostwidth >= dragArea.width + dragArea.left - 2 * scrollLeft) {
                    x = dragArea.width + dragArea.left - hostwidth - scrollLeft;
                }
                if (y + hostheight >= dragArea.height + dragArea.top - scrollTop) {
                    y = dragArea.height + dragArea.top - hostheight - scrollTop;
                }
                return { x: x, y: y };
            },

            _performLayout: function () {
                this._performHeaderLayout();
                this._performWidgetLayout();
            },

            _parseDragAreaAttributes: function () {
                if (this.dragArea !== null) {
                    this.dragArea.height = parseInt(this.dragArea.height, 10);
                    this.dragArea.width = parseInt(this.dragArea.width, 10);
                    this.dragArea.top = parseInt(this.dragArea.top, 10);
                    this.dragArea.left = parseInt(this.dragArea.left, 10);
                }
            },

            _positionWindow: function () {
                this._parseDragAreaAttributes();
                if (this.position instanceof Array && this.position.length === 2 &&
                    typeof this.position[0] === 'number' &&
                    typeof this.position[1] === 'number') {
                    this.element.style.left = this._toPx(this.position[0]);
                    this.element.style.top = this._toPx(this.position[1]);
                } else if (this.position instanceof Object) {
                    if (this.position.left) {
                        this.host.offset(this.position);
                    }
                    else if (this.position.x !== undefined && this.position.y !== undefined) {
                        this.element.style.left = this._toPx(this.position.x);
                        this.element.style.top = this._toPx(this.position.y);
                    }
                    else if (this.position.center) {
                        this._centerElement(this.host, this.position.center, 'xy');
                        var coord = this.position.center.coord();
                        var left = parseInt(this.host.css('left'), 10);
                        var top = parseInt(this.host.css('top'), 10);
                        this.element.style.left = this._toPx(left + coord.left);
                        this.element.style.top = this._toPx(top + coord.top);
                    }
                } else {
                    this._positionFromLiteral();
                }
            },

            _getDraggingArea: function () {
                var draggingArea = {};
                draggingArea.left = ((this.dragArea && this.dragArea.left) ? this.dragArea.left : 0);
                draggingArea.top = ((this.dragArea && this.dragArea.top) ? this.dragArea.top : 0);
                draggingArea.width = ((this.dragArea && this.dragArea.width) ? this.dragArea.width : this._getDocumentSize().width);
                draggingArea.height = ((this.dragArea && this.dragArea.height) ? this.dragArea.height : this._getDocumentSize().height);
                return draggingArea;
            },

            _positionFromLiteral: function () {
                if (!(this.position instanceof Array)) {
                    this.position = this.position.split(',');
                }
                var count = this.position.length, dragArea = this._getDraggingArea();
                while (count) {
                    count -= 1;
                    this.position[count] = this.position[count].replace(/ /g, '');
                    switch (this.position[count]) {
                        case 'top':
                            this.element.style.top = this._toPx(dragArea.top);
                            break;
                        case 'left':
                            this.element.style.left = this._toPx(dragArea.left);
                            break;
                        case 'bottom':
                            this.element.style.top = this._toPx(dragArea.height - this.host.height() + dragArea.top);
                            break;
                        case 'right':
                            this.element.style.left = this._toPx(dragArea.left + dragArea.width - this.host.width());
                            break;
                        default:
                            if (!this.dragArea) {
                                dragArea = $(window);
                            }
                            this._centerElement(this.host, dragArea, 'xy');
                            break;
                    }
                }
            },

            _raiseEvent: function (eventId) {
                var eventType = this._events[eventId], event = $.Event(eventType), args = {};
                if (eventId === 2 || eventId === 3) {
                    args.x = arguments[1];
                    args.y = arguments[2];
                    args.pageX = arguments[3];
                    args.pageY = arguments[4];
                }
                if (eventType === 'closed' || eventType === 'close') {
                    args.dialogResult = this.dialogResult;
                }
                event.args = args;
                return this.host.trigger(event);
            },

            destroy: function () {
                this.removeHandler($(window), 'resize.window' + this.element.id);
                this._removeEventHandlers();
                this._destroy();
            },

            _destroy: function () {
                if (this.isModal) {
                    if (this._modalBackground !== null) {
                        $(this._modalBackground).remove();
                    }
                    this.host.jqxWindow({ isModal: false });
                }
                if (this.restricter) {
                    this.removeHandler($(window), 'resize.' + this.element.id);
                    this.removeHandler($(window), 'orientationchanged.' + this.element.id);
                    this.removeHandler($(window), 'orientationchange.' + this.element.id);
                }
                this.host.remove();
                if (this._modalBackground !== null) {
                    $(this._modalBackground).remove();
                }
            },

            _toClose: function (closeCurrent, target) {
                return ((closeCurrent && target[0] === this.element) ||
                    (target[0] !== this.element && typeof target[0] === 'object'));
            },

            propertyChangedHandler: function (object, key, oldvalue, value) {
                this._validateProperties();
                switch (key) {
                    case 'rtl':
                        this._performLayout();
                        break;
                    case 'dragArea':
                        this._positionWindow();
                        break;
                    case 'collapseButtonSize':
                        this._performLayout();
                        break;
                    case 'closeButtonSize':
                        this._performLayout();
                        break;
                    case 'isModal':
                        this._refresh();
                        this._fixWindowZIndex();
                        if (value === false) {
                            var modalWindows = $.data(document.body, 'jqxwindows-modallist');
                            var updatedModalWindows = [];
                            for (var i = 0; i < modalWindows.length; i++) {
                                var currentWindow = modalWindows[i][0];
                                if (currentWindow !== this.element) {
                                    updatedModalWindows.push(modalWindows[i]);
                                }
                            }
                        }
                        $.data(document.body, 'jqxwindows-modallist', updatedModalWindows);
                        break;
                    case 'keyboardCloseKey':
                        this._removeEventHandlers();
                        this._addEventHandlers();
                        break;
                    case 'disabled':
                        if (value) {
                            this.disable();
                        } else {
                            this.disabled = true;
                            this.enable();
                        }
                        break;
                    case 'showCloseButton':
                    case 'showCollapseButton':
                        this._performLayout();
                        break;
                    case 'height':
                        this._performLayout();
                        break;
                    case 'width':
                        this._performLayout();
                        break;
                    case 'title':
                        this.setTitle(value);
                        this.title = value;
                        break;
                    case 'content':
                        this.setContent(value);
                        break;
                    case 'draggable':
                        this._removeEventHandlers();
                        this._addEventHandlers();
                        this._removeResize();
                        this._initializeResize();
                        break;
                    case 'resizable':
                        this.enableResize = value;

                        if (value) {
                            this._initializeResize();
                        } else {
                            this._removeResize();
                        }
                        break;
                    case 'position':
                        this._positionWindow();
                        break;
                    case 'modalOpacity':
                        this._setModalBackgroundStyles();
                        break;
                    case 'okButton':
                        if (value) {
                            this._addDialogButtonsHandlers();
                        } else {
                            this.removeHandler(this.okButton);
                        }
                        break;
                    case 'cancelButton':
                        if (value) {
                            this._addDialogButtonsHandlers();
                        } else {
                            this.removeHandler(this.cancelButton);
                        }
                        break;
                    case 'collapsed':
                        if (value) {
                            if (!oldvalue) {
                                this.collapsed = false;
                                this.collapse(0);
                            }
                        } else {
                            if (oldvalue) {
                                this.collapsed = true;
                                this.expand(0);
                            }
                        }
                        break;
                    case 'theme':
                        $.jqx.utilities.setTheme(oldvalue, value, this.host);
                        break;
                    case 'enableResize':
                        return;
                    case 'maxWidth':
                    case 'maxHeight':
                    case 'minWidth':
                    case 'minHeight':
                        object._performLayout();
                        object._removeResize();
                        object._initializeResize();
                        return;
                    default:
                        return;
                }
            },

            collapse: function (duration) {
                if (!this.collapsed && this._animationInProgress !== true) {
                    if (this.host.css('display') == 'none') {
                        return;
                    }

                    var self = this,
                        collapseHeight = this._header.outerHeight(true),
                        bottomBorder = parseInt(this._header.css('border-bottom-width'), 10),
                        bottomMargin = parseInt(this._header.css('margin-bottom'), 10);
                    duration = !isNaN(parseInt(duration, 10)) ? duration : this.collapseAnimationDuration;
                    if (!isNaN(bottomBorder)) {
                        collapseHeight -= 2 * bottomBorder;
                    }
                    if (!isNaN(bottomMargin)) {
                        collapseHeight += bottomMargin;
                    }
                    this._heightBeforeCollapse = this.host.height();
                    this._minHeightBeforeCollapse = this.host.css('min-height');
                    this.element.style.minHeight = this._toPx(collapseHeight);
                    self._animationInProgress = true;
                    this.host.animate({
                        height: collapseHeight
                    }, {
                        duration: duration,
                        complete: function () {
                            self._animationInProgress = false;
                            self.collapsed = true;
                            self._collapseButton.addClass(self.toThemeProperty('jqx-window-collapse-button-collapsed'));
                            self._collapseButton.addClass(self.toThemeProperty('jqx-icon-arrow-down'));
                            self._content[0].style.display = 'none';
                            self._raiseEvent(5);
                            self._raiseEvent(9);
                            $.jqx.aria(self, 'aria-expanded', false);
                        }
                    });
                }
            },

            expand: function (duration) {
                if (this.collapsed && this._animationInProgress !== true) {

                    var self = this;
                    duration = !isNaN(parseInt(duration, 10)) ? duration : this.collapseAnimationDuration;
                    self._animationInProgress = true;
                    this.host.animate({
                        'height': this._heightBeforeCollapse
                    }, {
                        duration: duration,
                        complete: function () {
                            self._animationInProgress = false;
                            self.collapsed = false;
                            self.element.style.minHeight = self._toPx(self._minHeightBeforeCollapse);
                            self._collapseButton.removeClass(self.toThemeProperty('jqx-window-collapse-button-collapsed'));
                            self._collapseButton.removeClass(self.toThemeProperty('jqx-icon-arrow-down'));

                            self._content[0].style.display = 'block';
                            self._raiseEvent(6);
                            self._performWidgetLayout();
                            self._raiseEvent(9);
                            $.jqx.aria(self, 'aria-expanded', true);
                        }
                    });
                }
            },

            //Closing all open windows which are not modal
            closeAll: function (closeCurrent) {
                closeCurrent = true;
                var windows = $.data(document.body, 'jqxwindows-list'),
                    count = windows.length, modal = $.data(document.body, 'jqxwindow-modal') || [];
                while (count) {
                    count -= 1;
                    if (this._toClose(closeCurrent, windows[count])) {
                        windows[count].jqxWindow('closeWindow', 'close');
                        windows.splice(count, 1);
                    }
                }
                if (this._toClose(closeCurrent, modal)) {
                    modal.jqxWindow('closeWindow', 'close');
                    $.data(document.body, 'jqxwindow-modal', []);
                }
                $.data(document.body, 'jqxwindows-list', windows);
            },

            //Setting window's title
            setTitle: function (title) {
                if (typeof title === 'string') {
                    this._headerContentWrapper.html(title);
                } else if (typeof title === 'object') {
                    try {
                        this._headerContentWrapper[0].innerHTML = '';
                        if (title instanceof HTMLElement) {
                            this._headerContentWrapper[0].appendChild(title);
                        } else if (title.appendTo) {
                            title.appendTo(this._headerContentWrapper);
                        }
                    } catch (error) {
                        throw new Error(error);
                    }
                }

                this.title = title;
                this._performLayout();
            },

            //Setting window's content
            setContent: function (content) {
                this._contentInitialized = false;

                var parent = this._content,
                    finished = false;
                while (!finished) {
                    parent[0].style.width = 'auto';
                    parent[0].style.height = 'auto';
                    if (parent.hasClass('jqx-window')) {
                        finished = true;
                    } else {
                        parent = $(parent[0].parentNode);
                    }
                }
                if ($.isArray(content)) {
                    for (var i = 0; i < content.length; i++) {
                        content[i].appendTo(this._content);
                    }
                } else if (typeof content === 'string') {
                    $(this._content[0]).html(content);
                } else if (typeof content === 'object') {
                    try {
                        this._content[0].innerHTML = '';
                        if (content instanceof HTMLElement) {
                            this._content[0].appendChild(content);
                        } else if (content.appendTo) {
                            content.appendTo(this._content);
                        }
                    } catch (error) {
                        throw new Error(error);
                    }
                }

                this.content = content;
                this._performLayout();
            },

            //Disabling the window
            disable: function () {
                this.disabled = true;
                this._removeEventHandlers();
                this._header.addClass(this.toThemeProperty('jqx-window-header-disabled'));
                this._closeButton.addClass(this.toThemeProperty('jqx-window-close-button-disabled'));
                this._collapseButton.addClass(this.toThemeProperty('jqx-window-collapse-button-disabled'));
                this._content.addClass(this.toThemeProperty('jqx-window-content-disabled'));
                this.host.addClass(this.toThemeProperty('jqx-window-disabled'));
                this.host.addClass(this.toThemeProperty('jqx-fill-state-disabled'));
                this._removeResize();
            },

            //Enabling the window
            enable: function () {
                if (this.disabled) {
                    this._addEventHandlers();
                    this._header.removeClass(this.toThemeProperty('jqx-window-header-disabled'));
                    this._content.removeClass(this.toThemeProperty('jqx-window-content-disabled'));
                    this._closeButton.removeClass(this.toThemeProperty('jqx-window-close-button-disabled'));
                    this._collapseButton.removeClass(this.toThemeProperty('jqx-window-collapse-button-disabled'));
                    this.host.removeClass(this.toThemeProperty('jqx-window-disabled'));
                    this.host.removeClass(this.toThemeProperty('jqx-fill-state-disabled'));
                    this.disabled = false;
                    this._initializeResize();
                }
            },

            //Returning true if the window is open (not hidden) and false if it is closed (hidden)
            isOpen: function () {
                return this._visible;
            },

            //Closing the window
            closeWindow: function (action) {
                var self = this;
                action = (typeof action === 'undefined') ? this.closeButtonAction : action;
                this.hide(function () {
                    if (action === 'close') {
                        self._destroy();
                    }
                });
            },

            //Bringing the window to the front
            bringToFront: function () {
                var windows = $.data(document.body, 'jqxwindows-list');
                if (this.isModal) {
                    windows = $.data(document.body, 'jqxwindows-modallist');
                    this._fixWindowZIndex('modal-hide');
                    this._fixWindowZIndex('modal-show');
                    return;
                }

                var upperWindow = windows[windows.length - 1],
                    zIndex = parseInt(upperWindow.css('z-index'), 10),
                    currentElementIndex = this._indexOf(this.host, windows);
                for (var i = windows.length - 1; i > currentElementIndex; i -= 1) {
                    var currentZIndex = parseInt(windows[i].css('z-index'), 10) - 1;
                    windows[i][0].style.zIndex = currentZIndex;
                }
                this.element.style.zIndex = zIndex;
                this._sortByStyle('z-index', windows);
            },

            //Hiding/closing the current window
            hide: function (callback, duration, notRaiseEvent) {
                var that = this;
                if (this.closing) {
                    var res = this.closing();
                    if (res === false) {
                        return;
                    }
                }

                duration = duration || this.closeAnimationDuration;
                switch (this.animationType) {
                    case 'none':
                        this.element.style.display = 'none';
                        break;
                    case 'fade':
                        that._animationInProgress = true;
                        this.host.fadeOut({
                            duration: duration,
                            callback: function () {
                                that._animationInProgress = false;
                                if (callback instanceof Function) {
                                    callback();
                                }
                            }
                        });
                        break;
                    case 'slide':
                        that._animationInProgress = true;
                        this.host.slideUp({
                            duration: duration,
                            callback: function () {
                                that._animationInProgress = false;
                                if (callback instanceof Function) {
                                    callback();
                                }
                            }
                        });
                        break;
                    case 'combined':
                        that._animationInProgress = true;
                        this.host.animate({
                            opacity: 0,
                            width: '0px',
                            height: '0px'
                        }, {
                            duration: duration,
                            complete: function () {
                                that._animationInProgress = false;
                                that.element.style.display = 'none';
                                if (callback instanceof Function) {
                                    callback();
                                }
                            }
                        });
                        break;
                }
                this._visible = false;
                if (this.isModal) {
                    $(this._modalBackground).hide();
                    this._fixWindowZIndex('modal-hide');
                }
                if (notRaiseEvent !== true) {
                    this._raiseEvent(1);
                    this._raiseEvent(8);
                }
            },

            open: function (callback, duration) {
                this.show(callback, duration);
            },

            close: function (callback, duration, notRaiseEvent) {
                this.hide(callback, duration, notRaiseEvent);
            },

            //Opening/showing the current window
            show: function (callback, duration) {
                var that = this;
                this._setDialogResult('none');
                duration = duration || this.showAnimationDuration;
                switch (this.animationType) {
                    case 'none':
                        this.element.style.display = 'block';
                        break;
                    case 'fade':
                        that._animationInProgress = true;
                        this.host.fadeIn({
                            duration: duration,
                            complete: function () {
                                that._animationInProgress = false;
                                if (callback instanceof Function) {
                                    callback();
                                }
                            }
                        });
                        break;
                    case 'slide':
                        that._animationInProgress = true;
                        this.host.slideDown({
                            duration: duration,
                            callback: function () {
                                that._animationInProgress = false;
                                if (callback instanceof Function) {
                                    callback();
                                }
                            }
                        });
                        break;
                    case 'combined':
                        this.element.style.display = 'block';
                        var targetWidth = that.host.width();
                        var targetHeight = that.host.height();
                        this.element.style.minWidth = '0px';
                        this.element.style.minHeight = '0px';
                        this.element.style.opacity = 0;
                        this.element.style.width = '0px';
                        this.element.style.height = '0px';
                        that._animationInProgress = true;
                        this.host.animate({
                            opacity: 1,
                            width: targetWidth + 'px',
                            height: targetHeight + 'px'
                        }, {
                            duration: duration,
                            complete: function () {
                                that._animationInProgress = false;
                                that._performLayout();
                                if (callback instanceof Function) {
                                    callback();
                                }
                            }
                        });
                        break;
                }
                if (this.isModal) {
                    $(this._modalBackground).show();
                    this._fixWindowZIndex('modal-show');
                }
                var me = this;
                if (!this._visible) {
                    //To remove this._raiseEvent(4); in the next version
                    //  this._raiseEvent(4);
                    if (duration > 150 && this.animationType != 'none') {
                        setTimeout(function () {
                            if (!me._contentInitialized) {
                                if (me.initContent) {
                                    me.initContent();
                                    me._contentInitialized = true;
                                }
                            }
                            me._raiseEvent(7);
                            me._raiseEvent(9);
                        }, duration - 150);
                    }
                    else {
                        if (!me._contentInitialized) {
                            if (me.initContent) {
                                me.initContent();
                                me._contentInitialized = true;
                            }
                        }
                        this._raiseEvent(7);
                        me._raiseEvent(9);
                    }
                }
                this._visible = true;
                if (that.animationType !== 'combined') {
                    this._performLayout();
                }
                if (this.autoFocus) {
                    // focus the displayed window.
                    var focusContent = function () {
                        if (!me._isTouchDevice) {
                            me._content[0].focus();
                        }
                    };
                    focusContent();
                    setTimeout(function () {
                        focusContent();
                    }, 100);
                }
            },

            _getTabbables: function () {
                var elements;
                if ($.jqx.browser.msie && $.jqx.browser.version < 9) {
                    elements = this._content.find('*');
                } else {
                    elements = this._content[0].querySelectorAll('*');
                }
                var tabbables = [];
                $.each(elements, function () {
                    if (tabbable(this)) {
                        tabbables[tabbables.length] = this;
                    }
                });
                return tabbables;
            },

            //Moving the current window
            move: function (x, y, event, raiseEvent) {
                var scrollLeft = 0, scrollTop = 0, position, pageX, pageY;
                x = parseInt(x, 10);
                y = parseInt(y, 10);
                if ($.jqx.browser.msie) {
                    if ($(window).width() > $(document).width() && !this.dragArea) {
                        scrollTop = this._SCROLL_WIDTH;
                    }
                    if ($(window).height() < $(document).height() &&
                        document.documentElement.clientWidth > document.documentElement.scrollWidth && !this.dragArea) {
                        scrollLeft = this._SCROLL_WIDTH;
                    }
                }
                position = this._validateCoordinates(x, y, scrollTop, scrollLeft);
                if (parseInt(this.host.css('left'), 10) !== position.x || parseInt(this.host.css('top'), 10) !== position.y) {
                    if (event) {
                        var pos = $.jqx.position(event);

                        pageX = pos.left;
                        pageY = pos.top;
                    }

                    if (pageX === undefined) {
                        pageX = x;
                    }
                    if (pageY === undefined) {
                        pageY = y;
                    }
                    if (raiseEvent !== false) {
                        this._raiseEvent(2, position.x, position.y, pageX, pageY);
                    }
                }
                this.element.style.left = position.x + 'px';
                this.element.style.top = position.y + 'px';
                this._moved = true;
            },

            _toPx: function (value) {
                if (typeof value === 'number') {
                    return value + 'px';
                } else {
                    return value;
                }
            }
        });

        function focusable(element, isTabIndexNotNaN) {
            var nodeName = element.nodeName.toLowerCase();
            if ('area' === nodeName) {
                var map = element.parentNode,
                    mapName = map.name,
                    img;
                if (!element.href || !mapName || map.nodeName.toLowerCase() !== 'map') {
                    return false;
                }
                img = $('img[usemap=#' + mapName + ']')[0];
                return !!img && visible(img);
            }
            return (/input|select|textarea|button|object/.test(nodeName) ? !element.disabled : 'a' == nodeName ? element.href || isTabIndexNotNaN : isTabIndexNotNaN) && visible(element);// the element and all of its ancestors must be visible
        }

        function visible(element) {
            var elementHelper = $(element);
            return elementHelper.css('display') !== 'none' && elementHelper.css('visibility') !== 'hidden';
        }

        function tabbable(element) {
            var tabIndex = element.getAttribute('tabindex'),
                isTabIndexNaN = tabIndex === null;
            return (isTabIndexNaN || tabIndex >= 0) && focusable(element, !isTabIndexNaN);
        }
    }(jqxBaseFramework)); //ignore jslint

    (function ($) {
        'use strict';
        var resizeModule = (function ($) {
            return {

                resizeConfig: function () {
                    // Resize target
                    this.resizeTarget = null;
                    // Indicator's size
                    this.resizeIndicatorSize = 5;
                    // All children are saved here
                    this.resizeTargetChildren = null;
                    // Indicates if it's resizing
                    this.isResizing = false;
                    // Indicates if the cursor is in the resize area. It is usefull when you are using different cursors in your resize target
                    this.resizeArea = false;
                    // Setting target's minimal width
                    this.minWidth = 1;
                    // Setting target's max width
                    this.maxWidth = 100;
                    // Setting target's min height
                    this.minHeight = 1;
                    // Setting target's max height
                    this.maxHeight = 100;
                    // Setting target's parent
                    this.resizeParent = null;
                    // Setting whether the resize is disabled
                    this.enableResize = true;

                    //this._cursorBackup;
                    this._resizeEvents = ['resizing', 'resized', 'resize'];

                    //Private variables
                    this._resizeMouseDown = false;
                    this._resizeCurrentMode = null;
                    this._mouseResizePosition = {};
                    this._resizeMethods = null;
                    this._SCROLL_WIDTH = 21;
                },

                _resizeExceptions: {
                    'invalidTarget': 'Invalid target!',
                    'invalidMinHeight': 'Invalid minimal height!',
                    'invalidMaxHeight': 'Invalid maximum height!',
                    'invalidMinWidth': 'Invalid minimum width!',
                    'invalidMaxWidth': 'Invalid maximum width!',
                    'invalidIndicatorSize': 'Invalid indicator size!',
                    'invalidSize': 'Invalid size!'
                },

                removeResize: function () {
                    if (this.resizeTarget) {
                        var resizer = $(this.resizeTarget.children('.jqx-resize'));
                        resizer.detach();
                        var content = resizer.children();
                        this._removeResizeEventListeners();
                        for (var i = 0; i < content.length; i += 1) {
                            $(content[i]).detach();
                            this.resizeTarget.append(content[i]);
                        }
                        resizer.remove();
                    }
                    this._resizeDirection = null;
                    //resizer.remove();
                },

                //Initializing all variables
                initResize: function (config) {
                    this.resizeConfig();
                    this.resizeTarget = $(config.target);
                    this.resizeIndicatorSize = config.indicatorSize || 10;
                    this.maxWidth = config.maxWidth || 100;
                    this.minWidth = config.minWidth || 1;
                    this.maxHeight = config.maxHeight || 100;
                    this.minHeight = config.minHeight || 1;
                    this.resizeParent = config.resizeParent;
                    this._parseResizeParentProperties();
                    this._validateResizeProperties();
                    this._validateResizeTargetDimensions();
                    this._getChildren(this.resizeTarget.maxWidth, this.resizeTarget.minWidth,
                        this.resizeTarget.maxHeight, this.resizeTarget.minHeight, config.alsoResize);
                    this._refreshResize();
                    this._cursorBackup = this.resizeTarget.css('cursor');
                    if (this._cursorBackup === 'auto') {
                        this._cursorBackup = 'default';
                    }
                },

                _validateResizeTargetDimensions: function () {
                    this.resizeTarget.maxWidth = this.maxWidth;
                    this.resizeTarget.minWidth = ((3 * this.resizeIndicatorSize > this.minWidth) ? 3 * this.resizeIndicatorSize : this.minWidth);
                    this.resizeTarget.maxHeight = this.maxHeight;
                    this.resizeTarget.minHeight = ((3 * this.resizeIndicatorSize > this.minHeight) ? 3 * this.resizeIndicatorSize : this.minHeight);
                },

                _parseResizeParentProperties: function () {
                    if (this.resizeParent) {
                        this.resizeParent.left = parseInt(this.resizeParent.left, 10);
                        this.resizeParent.top = parseInt(this.resizeParent.top, 10);
                        this.resizeParent.width = parseInt(this.resizeParent.width, 10);
                        this.resizeParent.height = parseInt(this.resizeParent.height, 10);
                    }
                },

                //Getting all children and setting their max and min height/width. First we are calculating their ratio
                //to the main container which we are going to modify to be resizable.
                _getChildren: function (maxWidth, minWidth, maxHeight, minHeight, selector) {
                    this.resizeTargetChildren = $(selector);
                    this.resizeTargetChildren = this.resizeTargetChildren.toArray();
                    var count = this.resizeTargetChildren.length;
                    while (count) {
                        count -= 1;
                        this.resizeTargetChildren[count] = $(this.resizeTargetChildren[count]);
                    }
                },

                _refreshResize: function () {
                    this._renderResize();
                    this._performResizeLayout();
                    this._removeResizeEventListeners();
                    this._addResizeEventHandlers();
                },

                //Creating inner wrapper which is going to be our resize helper
                _renderResize: function () {
                    var that = this;

                    if (that._resizeWrapper !== undefined && $(that._resizeWrapper).parents().length > 0) {
                        return;
                    }

                    var wrapper = document.createElement('div');
                    wrapper.className = 'jqx-resize jqx-rc-all';
                    wrapper.style.zIndex = 8000;
                    wrapper.appendChild(that._header[0]);
                    wrapper.appendChild(that._content[0]);
                    that.resizeTarget[0].appendChild(wrapper);
                    that._resizeWrapper = wrapper;
                },

                _performResizeLayout: function () {
                    this._resizeWrapper.style.height = this.resizeTarget.height() + 'px';
                    this._resizeWrapper.style.width = this.resizeTarget.width() + 'px';
                },

                _removeResizeEventListeners: function () {
                    var resizetargetid = this.resizeTarget.attr('id');

                    this.removeHandler(this._resizeWrapper, 'mousemove.resize' + resizetargetid);
                    this.removeHandler(this._resizeWrapper, 'mousedown.resize' + resizetargetid);
                    this.removeHandler($(document), 'mousemove.resize' + resizetargetid);
                    this.removeHandler($(document), 'mouseup.resize' + resizetargetid);
                },

                _addResizeEventHandlers: function () {
                    var resizetargetid = this.resizeTarget.attr('id');
                    var self = this;

                    if (self._isTouchDevice) {
                        this.addHandler(this._resizeWrapper, 'touchmove.resize.' + resizetargetid, function (event) {
                            self._resizeCursorChangeHandler(self, event);
                        });
                        this.addHandler(this._resizeWrapper, 'touchstart.resize.' + resizetargetid, function (event) {
                            self._resizeCursorChangeHandler(self, event);
                            self._resizeMouseDownHandler(self, event);
                        });

                        this.addHandler($(document), 'touchmove.resize.' + resizetargetid, function (event) {
                            return self._resizeHandler(self, event);
                        });
                        this.addHandler($(document), 'touchend.resize.' + resizetargetid, function (event) {
                            self._stopResizing(self, event);
                        });
                    }
                    else {
                        this.addHandler(this._resizeWrapper, 'mousemove.resize.' + resizetargetid, function (event) {
                            self._resizeCursorChangeHandler(self, event);
                        });
                        this.addHandler(this._resizeWrapper, 'mousedown.resize.' + resizetargetid, function (event) {
                            self._resizeMouseDownHandler(self, event);
                        });

                        this.addHandler($(document), 'mousemove.resize.' + resizetargetid, function (event) {
                            return self._resizeHandler(self, event);
                        });
                        this.addHandler($(document), 'mouseup.resize.' + resizetargetid, function (event) {
                            self._stopResizing(self, event);
                        });
                    }

                    try {
                        if (document.referrer !== '' || window.frameElement) {
                            var eventHandle = function (event) {
                                self._stopResizing(self, event);
                            };

                            if (window.top.document.addEventListener) {
                                window.top.document.addEventListener('mouseup', eventHandle, false);

                            } else if (window.top.document.attachEvent) {
                                window.top.document.attachEvent('on' + 'mouseup', eventHandle);
                            }
                        }
                    }
                    catch (error) {
                    }
                },

                _stopResizing: function (self) {
                    if (self.enableResize) {
                        if (self.isResizing) {
                            self._raiseResizeEvent(1);
                        }
                        self._resizeMouseDown = false;
                        self.isResizing = false;
                        self._resizeDirection = null;
                        if (self.resizeTarget) {
                            self.resizeTarget.removeClass('jqx-disableselect');
                        }
                    }

                    if (self._cursorBackup == 'undefined') {
                        self._cursorBackup = 'default';
                    }

                    if (self._resizeWrapper) {
                        self._resizeWrapper.style.cursor = self._cursorBackup;
                    }
                },

                _resizeHandler: function (self, event) {
                    if (self.enableResize && !self.collapsed) {
                        if (self.isResizing && self._resizeDirection) {
                            if (event.which === 0 && $.jqx.browser.msie && $.jqx.browser.version < 9) {
                                self._stopResizing(event);
                            }
                            if (self._isTouchDevice) {
                                var position = $.jqx.position(event);
                                self._performResize(position.left, position.top);

                                return false;
                            }
                            self._performResize(event.pageX, event.pageY);
                            return false;
                        } else {
                            if (self._isTouchDevice) {
                                var position = $.jqx.position(event);
                                return self._resizeCaptureCursor(position.left, position.top);
                            }

                            return self._resizeCaptureCursor(event.pageX, event.pageY);
                        }
                    }
                },

                _resizeCaptureCursor: function (mouseX, mouseY) {
                    if (this._resizeMouseDown && !this.isResizing && this._resizeDirection) {
                        var offset = 3;
                        if (this._isTouchDevice) {
                            this._changeCursor(mouseX - parseInt(this.resizeTarget.css('left'), 10), mouseY - parseInt(this.resizeTarget.css('top'), 10));
                            this._mouseResizePosition = { x: mouseX, y: mouseY };
                            this._prepareResizeMethods(this._resizeDirection);
                            this._resizeBackupData();
                            this.isResizing = true;
                            this.resizeTarget.addClass('jqx-disableselect');
                            return false;
                        }

                        if ((mouseX + offset < this._mouseResizePosition.x || mouseX - offset > this._mouseResizePosition.x) ||
                            (mouseY + offset < this._mouseResizePosition.y || mouseY - offset > this._mouseResizePosition.y)) {
                            this._changeCursor(mouseX - parseInt(this.resizeTarget.css('left'), 10), mouseY - parseInt(this.resizeTarget.css('top'), 10));
                            this._mouseResizePosition = { x: mouseX, y: mouseY };
                            this._prepareResizeMethods(this._resizeDirection);
                            this._resizeBackupData();
                            this.isResizing = true;
                            this.resizeTarget.addClass('jqx-disableselect');
                            return false;
                        }
                    }
                },

                _resizeBackupData: function () {
                    this.resizeTarget.lastWidth = this.resizeTarget.width();
                    this.resizeTarget.lastHeight = this.resizeTarget.height();
                    this.resizeTarget.x = parseInt(this.resizeTarget.css('left'), 10);
                    this.resizeTarget.y = parseInt(this.resizeTarget.css('top'), 10);
                    this._resizeBackupChildrenSize();
                },

                _resizeBackupChildrenSize: function () {
                    var count = this.resizeTargetChildren.length, child;
                    while (count) {
                        count -= 1;
                        child = this.resizeTargetChildren[count];
                        this.resizeTargetChildren[count].lastWidth = child.width();
                        this.resizeTargetChildren[count].lastHeight = child.height();
                    }
                },

                _performResize: function (mouseX, mouseY) {
                    var differenceX = mouseX - this._mouseResizePosition.x,
                        differenceY = mouseY - this._mouseResizePosition.y;
                    if (this._resizeDirection) {
                        this._resize(this.resizeTarget, differenceX, differenceY);
                    }
                },

                _resizeCursorChangeHandler: function (self, event) {
                    if (self.enableResize && !self.collapsed) {
                        if (!self.isResizing) {
                            if (self._isTouchDevice) {
                                var position = $.jqx.position(event);
                                self._changeCursor(position.left - parseInt(self.resizeTarget.css('left'), 10),
                                    position.top - parseInt(self.resizeTarget.css('top'), 10));

                                return;
                            }
                            self._changeCursor(event.pageX - parseInt(self.resizeTarget.css('left'), 10),
                                event.pageY - parseInt(self.resizeTarget.css('top'), 10));
                        }
                    }
                },

                _resizeMouseDownHandler: function (self, event) {
                    if (self.enableResize) {
                        if (self._resizeDirection !== null) {
                            self._resizeMouseDown = true;
                            if (self._isTouchDevice) {
                                var position = $.jqx.position(event);
                                self._mouseResizePosition.x = position.left;
                                self._mouseResizePosition.y = position.top;
                            }
                            else {
                                self._mouseResizePosition.x = event.pageX;
                                self._mouseResizePosition.y = event.pageY;
                            }
                            event.preventDefault();
                        }
                    }
                },

                _validateResizeProperties: function () {
                    try {
                        if (!this.resizeTarget || this.resizeTarget.length !== 1) {
                            throw new Error(this._resizeExceptions.invalidTarget);
                        }
                        if (this.minHeight < 0 || isNaN(parseInt(this.minHeight, 10))) {
                            throw new Error(this._resizeExceptions.invalidMinHeight);
                        }
                        if (this.maxHeight <= 0 || isNaN(parseInt(this.maxHeight, 10))) {
                            throw new Error(this._resizeExceptions.invalidMaxHeight);
                        }
                        if (this.minWidth < 0 || isNaN(parseInt(this.minWidth, 10))) {
                            throw new Error(this._resizeExceptions.invalidMinWidth);
                        }
                        if (this.maxWidth < 0 || isNaN(parseInt(this.maxWidth, 10))) {
                            throw new Error(this._resizeExceptions.invalidMaxWidth);
                        }
                        if (this.resizeIndicatorSize < 0 || isNaN(parseInt(this.resizeIndicatorSize, 10))) {
                            throw new Error(this._resizeExceptions.invalidIndicatorSize);
                        }
                        if (this.minHeight > this.maxHeight ||
                            this.minWidth > this.maxWidth) {
                            throw new Error(this._resizeExceptions.invalidSize);
                        }
                        //if (this.resizeParent && this.resizeParent.width && this.resizeParent.height && this.resizeParent.left &&
                        //    this.resizeParent.top && ((this.resizeParent.width < this.resizeTarget.width() || this.resizeParent.width < this.maxWidth) ||
                        //    (this.resizeParent.height < this.resizeTarget.height() || this.resizeParent.height < this.maxHeight))) {
                        //    throw new Error(this._resizeExceptions['invalidSize']);
                        //}
                    } catch (exception) {
                        throw new Error(exception);
                    }
                },

                //This method is checking cursor's position and setting specific pointer depending on mouse coordinates.
                //It's also detecting resize direction and creating string with it. For example for top-left resize the string is going to be 'topleft'.
                _changeCursor: function (x, y) {
                    if (this.isResizing || this._resizeMouseDown) {
                        return;
                    }
                    this.resizeArea = true;
                    if (x <= this.resizeIndicatorSize && x >= 0 && y <= this.resizeIndicatorSize && y > 0) {    //top left
                        this._resizeWrapper.style.cursor = 'nw-resize';
                        this._resizeDirection = 'topleft';
                    } else if (y <= this.resizeIndicatorSize && y > 0 && x >= this.resizeTarget.width() - this.resizeIndicatorSize) { //top right
                        this._resizeWrapper.style.cursor = 'ne-resize';
                        this._resizeDirection = 'topright';
                    } else if (y >= this.resizeTarget.height() - this.resizeIndicatorSize && //bottom left
                        y < this.resizeTarget.height() &&
                        x <= this.resizeIndicatorSize && x >= 0) {
                        this._resizeWrapper.style.cursor = 'sw-resize';
                        this._resizeDirection = 'bottomleft';
                    } else if (y >= this.resizeTarget.height() - this.resizeIndicatorSize && //bottom right
                        y < this.resizeTarget.height() &&
                        x >= this.resizeTarget.width() - this.resizeIndicatorSize &&
                        x < this.resizeTarget.width()) {
                        this._resizeWrapper.style.cursor = 'se-resize';
                        this._resizeDirection = 'bottomright';
                    } else if (x <= this.resizeIndicatorSize && x >= 0) { //left
                        this._resizeWrapper.style.cursor = 'e-resize';
                        this._resizeDirection = 'left';
                    } else if (y <= this.resizeIndicatorSize && y > 0) { //top
                        this._resizeWrapper.style.cursor = 'n-resize';
                        this._resizeDirection = 'top';
                    } else if (y >= this.resizeTarget.height() - this.resizeIndicatorSize && //bottom
                        y < this.resizeTarget.height()) {
                        this._resizeWrapper.style.cursor = 'n-resize';
                        this._resizeDirection = 'bottom';
                    } else if (x >= this.resizeTarget.width() - this.resizeIndicatorSize &&  //right
                        x < this.resizeTarget.width()) {
                        this._resizeWrapper.style.cursor = 'e-resize';
                        this._resizeDirection = 'right';
                    } else {
                        this._resizeWrapper.style.cursor = this._cursorBackup;
                        this._resizeDirection = null;
                        this.resizeArea = false;
                    }
                },

                //Putting all methods which are going to be used along the resize action (for example _resizeRight, _resizeTop) into an array.
                //We are performing this because if we are checking and calling the right methods along the resizing (on mousemove)
                //we should make more checks.
                _prepareResizeMethods: function (direction) {
                    this._resizeMethods = [];
                    if (direction.indexOf('left') >= 0) { this._resizeMethods.push(this._resizeLeft); }
                    if (direction.indexOf('top') >= 0) { this._resizeMethods.push(this._resizeTop); }
                    if (direction.indexOf('right') >= 0) { this._resizeMethods.push(this._resizeRight); }
                    if (direction.indexOf('bottom') >= 0) { this._resizeMethods.push(this._resizeBottom); }
                },

                _validateResize: function (newWidth, newHeight, direction, element, side) {
                    if (direction === 'horizontal' || direction === 'both') {
                        return this._validateWidth(newWidth, element, side);
                    } else if (direction === 'vertical' || direction === 'both') {
                        return this._validateHeight(newHeight, element, side);
                    }
                    return { result: false, fix: 0 };
                },

                _getParent: function () {
                    if (this.resizeParent !== null && this.resizeParent !== 'undefined' && this.resizeParent.height && this.resizeParent.width &&
                        this.resizeParent.top && this.resizeParent.left) {
                        return this.resizeParent;
                    }
                    return {
                        left: 0, top: 0,
                        width: $(document).width(), height: $(document).height()
                    };
                },

                _validateHeight: function (newHeight, element, side) {
                    var scrollTop = 0,
                        heightDisplacement = 2,
                        resizeParent = this._getParent();

                    if ($(window).width() > $(document).width() && $.jqx.browser.msie && resizeParent.height === $(document).height()) {
                        scrollTop = this._SCROLL_WIDTH;
                    }
                    if (side === 'bottom' && (newHeight + element.position().top + scrollTop + heightDisplacement > resizeParent.height + resizeParent.top)) {   //fixing if user is trying to resize it more than the window
                        return { fix: resizeParent.height - element.position().top - scrollTop - heightDisplacement + resizeParent.top, result: false };
                    }
                    if (side === 'top' && element.lastHeight - newHeight + element.y < resizeParent.top) { //check if the user is trying to drag it in the window's top
                        return { fix: newHeight + (element.lastHeight - newHeight + element.y) - resizeParent.top, result: false };
                    }
                    if (newHeight < element.minHeight) {
                        return { fix: element.minHeight, result: false };
                    }
                    if (newHeight > element.maxHeight) {
                        return { fix: element.maxHeight, result: false };
                    }
                    return { result: true, fix: newHeight };
                },

                _validateWidth: function (newWidth, element, side) {
                    var scrollLeft = 0, widthDisplacement = 2, resizeParent = this._getParent();
                    if ($(window).height() < $(document).height() && $.jqx.browser.msie &&
                        document.documentElement.clientWidth >= document.documentElement.scrollWidth &&
                        resizeParent.width === $(document).width()) {    //check if there is a right but there is not a bottom one 
                        scrollLeft = this._SCROLL_WIDTH;
                    }
                    if (side === 'right' && (newWidth + element.position().left + scrollLeft + widthDisplacement > resizeParent.width + resizeParent.left)) {
                        return { fix: resizeParent.width - element.position().left - scrollLeft - widthDisplacement + resizeParent.left, result: false };
                    }
                    if (side === 'left' && (element.lastWidth - newWidth + element.x < resizeParent.left)) { //check if the user is trying to drag it in the window's left
                        return { fix: newWidth + (element.lastWidth - newWidth + element.x) - resizeParent.left, result: false };
                    }
                    if (newWidth < element.minWidth) {
                        return { fix: element.minWidth, result: false };
                    }
                    if (newWidth > element.maxWidth) {
                        return { fix: element.maxWidth, result: false };
                    }
                    return { result: true, fix: newWidth };
                },

                _resize: function (element, differenceX, differenceY) {
                    var length = this._resizeMethods.length;
                    for (var i = 0; i < length; i++) {
                        if (this._resizeMethods[i] instanceof Function) {
                            var properties = { element: element, x: differenceX, y: differenceY, self: this };
                            this._resizeMethods[i](properties);
                        }
                    }
                    this._performResizeLayout();
                },

                resize: function (width, height) {
                    if (this.resizable) {
                        var differenceX = width - this.host.width();
                        var differenceY = height - this.host.height();
                        var direction = 'right';
                        if (differenceY !== 0) {
                            direction = 'bottom';
                        }
                        this._resizeDirection = direction;
                        this._prepareResizeMethods(this._resizeDirection);
                        this._resizeBackupData();
                        this.isResizing = true;
                        this._resize(this.resizeTarget, differenceX, differenceY);
                        this.isResizing = false;

                        if (differenceX < 0 && differenceY !== 0) {
                            this._resizeDirection = 'right';
                            this._prepareResizeMethods(this._resizeDirection);
                            this._resizeBackupData();
                            this.isResizing = true;
                            this._resize(this.resizeTarget, differenceX, differenceY);
                            this.isResizing = false;
                        }

                        if (differenceX > 0 && differenceY > 0) {
                            this._resizeDirection = 'right';
                            this._prepareResizeMethods(this._resizeDirection);
                            this._resizeBackupData();
                            this.isResizing = true;
                            this._resize(this.resizeTarget, differenceX, differenceY);
                            this.isResizing = false;
                        }
                    }
                },

                _setResizeChildrenSize: function (size, dimention) {
                    var count = this.resizeTargetChildren.length;
                    while (count) {
                        count--;
                        if (dimention === 'width') {
                            var newWidth = this.resizeTargetChildren[count].lastWidth - (this.resizeTarget.lastWidth - size);
                            if (newWidth < this.resizeTarget.maxWidth && newWidth > 0) {
                                this.resizeTargetChildren[count].width(newWidth);
                            }
                        } else {
                            var newHeight = this.resizeTargetChildren[count].lastHeight - (this.resizeTarget.lastHeight - size);
                            if (newHeight < this.resizeTarget.maxHeight && newHeight > 0) {
                                this.resizeTargetChildren[count].height(newHeight);
                            }
                        }
                    }
                },

                _resizeRight: function (properties) {
                    var width = properties.element.lastWidth + properties.x,
                        result = properties.self._validateResize(width, 0, 'horizontal', properties.element, 'right');
                    if (!result.result) {
                        width = result.fix;
                    }
                    if (properties.element.width() !== width) {
                        properties.self._setResizeChildrenSize(width, 'width');
                        properties.element.width(width);
                        if (properties.self.width.toString().indexOf('%') >= 0) {
                            var onePercent = $(document.body).width() / 100;
                            var onePixelToPercentage = 1 / onePercent; // one pixel is equal to this amount of percentages.


                            properties.element[0].style.width = (onePixelToPercentage * width) + '%';;
                            properties.self._setChildrenLayout();
                        }
                        properties.self._raiseResizeEvent(0);
                    }
                    return width;
                },

                _resizeLeft: function (properties) {
                    var width = properties.element.lastWidth - properties.x,
                        result = properties.self._validateResize(width, 0, 'horizontal', properties.element, 'left'),
                        x = properties.element.x + properties.x;


                    if (!result.result) {
                        x = properties.element.x + (properties.element.lastWidth - result.fix);
                        width = result.fix;
                        return;
                    }
                    if (properties.element.width() !== width) {
                        properties.self._setResizeChildrenSize(width, 'width');
                        properties.element.width(width);
                        if (properties.self.width.toString().indexOf('%') >= 0) {
                            var onePercent = $(document.body).width() / 100;
                            var onePixelToPercentage = 1 / onePercent; // one pixel is equal to this amount of percentages.

                            properties.element[0].style.width = (onePixelToPercentage * width) + '%';
                            properties.self._setChildrenLayout();
                        }

                        properties.element[0].style.left = properties.self._toPx(x);
                        properties.self._raiseResizeEvent(0);
                    }
                    return width;
                },

                _resizeBottom: function (properties) {
                    var height = properties.element.lastHeight + properties.y,
                        result = properties.self._validateResize(0, height, 'vertical', properties.element, 'bottom');
                    if (!result.result) {
                        height = result.fix;
                    }
                    if (properties.element.height() !== height) {
                        properties.self._setResizeChildrenSize(height, 'height');
                        properties.element.height(height);

                        if (properties.self.height.toString().indexOf('%') >= 0) {
                            var onePercent = $(document.body).height() / 100;
                            var onePixelToPercentage = 1 / onePercent; // one pixel is equal to this amount of percentages.

                            properties.element[0].style.height = (onePixelToPercentage * height) + '%';
                            properties.self._setChildrenLayout();
                        }

                        properties.self._raiseResizeEvent(0);
                    }
                    return height;
                },

                _resizeTop: function (properties) {
                    var height = properties.element.lastHeight - properties.y,
                        result = properties.self._validateResize(0, height, 'vertical', properties.element, 'top'),
                        y = properties.element.y + properties.y;
                    if (!result.result) {
                        y = properties.element.y + (properties.element.lastHeight - result.fix);
                        height = result.fix;
                        return;
                    }
                    if (properties.element.height() !== height) {
                        properties.self._setResizeChildrenSize(height, 'height');
                        properties.element.height(height);

                        if (properties.self.height.toString().indexOf('%') >= 0) {
                            var onePercent = $(document.body).height() / 100;
                            var onePixelToPercentage = 1 / onePercent; // one pixel is equal to this amount of percentages.

                            properties.element[0].style.height = (onePixelToPercentage * height) + '%';
                            properties.self._setChildrenLayout();
                        }

                        properties.element[0].style.top = properties.self._toPx(y);
                        properties.self._raiseResizeEvent(0);
                    }
                    return height;
                },

                _raiseResizeEvent: function (eventId) {
                    var eventType = this._resizeEvents[eventId],
                        event = $.Event(eventType),
                        args = {};
                    args.width = parseInt(this.resizeTarget[0].style.width, 10);
                    args.height = parseInt(this.resizeTarget[0].style.height, 10);
                    event.args = args;
                    if (eventId === 0) {
                        eventType = this._resizeEvents[2];
                        var resizeEvent = $.Event(eventType);
                        resizeEvent.args = args;
                        this.resizeTarget.trigger(resizeEvent);
                    }

                    return this.resizeTarget.trigger(event);
                }
            };
        }(jqxBaseFramework)); //ignore jslint
        $.extend($.jqx._jqxWindow.prototype, resizeModule);
    }(jqxBaseFramework)); //ignore jslint
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
/* harmony import */ var _jqxwindow__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(7762);
/* harmony import */ var _jqxwindow__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_jqxwindow__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _jqxdocking__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3962);
/* harmony import */ var _jqxdocking__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_jqxdocking__WEBPACK_IMPORTED_MODULE_3__);





})();

/******/ })()
;