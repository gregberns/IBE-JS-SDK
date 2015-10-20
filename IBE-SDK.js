/**
   Module P: Generic Promises for TypeScript

   Project, documentation, and license: https://github.com/pragmatrix/Promise
*/
var P;
(function (P) {
    /**
        Returns a new "Deferred" value that may be resolved or rejected.
    */
    function defer() {
        return new DeferredI();
    }
    P.defer = defer;
    /**
        Converts a value to a resolved promise.
    */
    function resolve(v) {
        return defer().resolve(v).promise();
    }
    P.resolve = resolve;
    /**
        Returns a rejected promise.
    */
    function reject(err) {
        return defer().reject(err).promise();
    }
    P.reject = reject;
    /**
        http://en.wikipedia.org/wiki/Anamorphism

        Given a seed value, unfold calls the unspool function, waits for the returned promise to be resolved, and then
        calls it again if a next seed value was returned.

        All the values of all promise results are collected into the resulting promise which is resolved as soon
        the last generated element value is resolved.
    */
    function unfold(unspool, seed) {
        var d = defer();
        var elements = new Array();
        unfoldCore(elements, d, unspool, seed);
        return d.promise();
    }
    P.unfold = unfold;
    function unfoldCore(elements, deferred, unspool, seed) {
        var result = unspool(seed);
        if (!result) {
            deferred.resolve(elements);
            return;
        }
        while (result.next && result.promise.status == 2 /* Resolved */) {
            elements.push(result.promise.result);
            result = unspool(result.next);
            if (!result) {
                deferred.resolve(elements);
                return;
            }
        }
        result.promise.done(function (v) {
            elements.push(v);
            if (!result.next)
                deferred.resolve(elements);
            else
                unfoldCore(elements, deferred, unspool, result.next);
        }).fail(function (e) {
            deferred.reject(e);
        });
    }
    /**
        The status of a Promise. Initially a Promise is Unfulfilled and may
        change to Rejected or Resolved.
     
        Once a promise is either Rejected or Resolved, it can not change its
        status anymore.
    */
    (function (Status) {
        Status[Status["Unfulfilled"] = 0] = "Unfulfilled";
        Status[Status["Rejected"] = 1] = "Rejected";
        Status[Status["Resolved"] = 2] = "Resolved";
    })(P.Status || (P.Status = {}));
    var Status = P.Status;
    /**
        Creates a promise that gets resolved when all the promises in the argument list get resolved.
        As soon one of the arguments gets rejected, the resulting promise gets rejected.
        If no promises were provided, the resulting promise is immediately resolved.
    */
    function when() {
        var promises = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            promises[_i - 0] = arguments[_i];
        }
        var allDone = defer();
        if (!promises.length) {
            allDone.resolve([]);
            return allDone.promise();
        }
        var resolved = 0;
        var results = [];
        promises.forEach(function (p, i) {
            p.done(function (v) {
                results[i] = v;
                ++resolved;
                if (resolved === promises.length && allDone.status !== 1 /* Rejected */)
                    allDone.resolve(results);
            }).fail(function (e) {
                if (allDone.status !== 1 /* Rejected */)
                    allDone.reject(new Error("when: one or more promises were rejected"));
            });
        });
        return allDone.promise();
    }
    P.when = when;
    /**
        Implementation of a promise.

        The Promise<Value> instance is a proxy to the Deferred<Value> instance.
    */
    var PromiseI = (function () {
        function PromiseI(deferred) {
            this.deferred = deferred;
        }
        Object.defineProperty(PromiseI.prototype, "status", {
            get: function () {
                return this.deferred.status;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(PromiseI.prototype, "result", {
            get: function () {
                return this.deferred.result;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(PromiseI.prototype, "error", {
            get: function () {
                return this.deferred.error;
            },
            enumerable: true,
            configurable: true
        });
        PromiseI.prototype.done = function (f) {
            this.deferred.done(f);
            return this;
        };
        PromiseI.prototype.fail = function (f) {
            this.deferred.fail(f);
            return this;
        };
        PromiseI.prototype.always = function (f) {
            this.deferred.always(f);
            return this;
        };
        PromiseI.prototype.then = function (f) {
            return this.deferred.then(f);
        };
        return PromiseI;
    })();
    /**
        Implementation of a deferred.
    */
    var DeferredI = (function () {
        function DeferredI() {
            this._resolved = function (_) {
            };
            this._rejected = function (_) {
            };
            this._status = 0 /* Unfulfilled */;
            this._error = { message: "" };
            this._promise = new PromiseI(this);
        }
        DeferredI.prototype.promise = function () {
            return this._promise;
        };
        Object.defineProperty(DeferredI.prototype, "status", {
            get: function () {
                return this._status;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DeferredI.prototype, "result", {
            get: function () {
                if (this._status != 2 /* Resolved */)
                    throw new Error("Promise: result not available");
                return this._result;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(DeferredI.prototype, "error", {
            get: function () {
                if (this._status != 1 /* Rejected */)
                    throw new Error("Promise: rejection reason not available");
                return this._error;
            },
            enumerable: true,
            configurable: true
        });
        DeferredI.prototype.then = function (f) {
            var d = defer();
            this.done(function (v) {
                var promiseOrValue = f(v);
                // todo: need to find another way to check if r is really of interface
                // type Promise<any>, otherwise we would not support other 
                // implementations here.
                if (promiseOrValue instanceof PromiseI) {
                    var p = promiseOrValue;
                    p.done(function (v2) { return d.resolve(v2); }).fail(function (err) { return d.reject(err); });
                    return p;
                }
                d.resolve(promiseOrValue);
            }).fail(function (err) { return d.reject(err); });
            return d.promise();
        };
        DeferredI.prototype.done = function (f) {
            if (this.status === 2 /* Resolved */) {
                f(this._result);
                return this;
            }
            if (this.status !== 0 /* Unfulfilled */)
                return this;
            var prev = this._resolved;
            this._resolved = function (v) {
                prev(v);
                f(v);
            };
            return this;
        };
        DeferredI.prototype.fail = function (f) {
            if (this.status === 1 /* Rejected */) {
                f(this._error);
                return this;
            }
            if (this.status !== 0 /* Unfulfilled */)
                return this;
            var prev = this._rejected;
            this._rejected = function (e) {
                prev(e);
                f(e);
            };
            return this;
        };
        DeferredI.prototype.always = function (f) {
            this.done(function (v) { return f(v); }).fail(function (err) { return f(null, err); });
            return this;
        };
        DeferredI.prototype.resolve = function (result) {
            if (this._status !== 0 /* Unfulfilled */)
                throw new Error("tried to resolve a fulfilled promise");
            this._result = result;
            this._status = 2 /* Resolved */;
            this._resolved(result);
            this.detach();
            return this;
        };
        DeferredI.prototype.reject = function (err) {
            if (this._status !== 0 /* Unfulfilled */)
                throw new Error("tried to reject a fulfilled promise");
            this._error = err;
            this._status = 1 /* Rejected */;
            this._rejected(err);
            this.detach();
            return this;
        };
        DeferredI.prototype.detach = function () {
            this._resolved = function (_) {
            };
            this._rejected = function (_) {
            };
        };
        return DeferredI;
    })();
    function generator(g) {
        return function () { return iterator(g()); };
    }
    P.generator = generator;
    ;
    function iterator(f) {
        return new IteratorI(f);
    }
    P.iterator = iterator;
    var IteratorI = (function () {
        function IteratorI(f) {
            this.f = f;
            this.current = undefined;
        }
        IteratorI.prototype.advance = function () {
            var _this = this;
            var res = this.f();
            return res.then(function (value) {
                if (isUndefined(value))
                    return false;
                _this.current = value;
                return true;
            });
        };
        return IteratorI;
    })();
    /**
        Iterator functions.
    */
    function each(gen, f) {
        var d = defer();
        eachCore(d, gen(), f);
        return d.promise();
    }
    P.each = each;
    function eachCore(fin, it, f) {
        it.advance().done(function (hasValue) {
            if (!hasValue) {
                fin.resolve({});
                return;
            }
            f(it.current);
            eachCore(fin, it, f);
        }).fail(function (err) { return fin.reject(err); });
    }
    /**
        std
    */
    function isUndefined(v) {
        return typeof v === 'undefined';
    }
    P.isUndefined = isUndefined;
})(P || (P = {}));
String.prototype.format = function () {
    //if (!String.prototype.format) {
    //String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function (match, number) {
        return typeof args[number] != 'undefined' ? args[number] : match;
    });
    //};
    //}
};
/// <reference path="libs/String-Extensions.ts" />
/// <reference path="libs/jquery.d.ts" />
/// <reference path="libs/angular.d.ts" />
/// <reference path="libs/Promise.ts" />
/// <reference path="ibe.http.ts" />
/// <reference path="ibe.api.ts" />
/// <reference path="./_references.ts"/>
/// <reference path="./ibe.http.ts"/>
"use strict";
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var IBE;
(function (IBE) {
    var Core;
    (function (Core) {
        var Dictionary = (function () {
            function Dictionary(init) {
                this._keys = new Array();
                this._values = new Array();
                if (typeof init === "undefined" || init == null)
                    return;
                for (var x = 0; x < init.length; x++) {
                    this[init[x].key] = init[x].value;
                    this._keys.push(init[x].key);
                    this._values.push(init[x].value);
                }
            }
            Dictionary.prototype.add = function (key, value) {
                this[key] = value;
                this._keys.push(key);
                this._values.push(value);
            };
            Dictionary.prototype.update = function (key, value) {
                if (!this.containsKey(key)) {
                    throw "Dictionary does not contain key with value of: " + key;
                }
                var index = this._keys.indexOf(key, 0);
                this._values[index] = value;
            };
            Dictionary.prototype.remove = function (key) {
                var index = this._keys.indexOf(key, 0);
                this._keys.splice(index, 1);
                this._values.splice(index, 1);
                delete this[key];
            };
            Dictionary.prototype.keys = function () {
                return this._keys;
            };
            Dictionary.prototype.values = function () {
                return this._values;
            };
            Dictionary.prototype.item = function (key) {
                if (!this.containsKey(key)) {
                    throw "Dictionary does not contain key with value of: " + key;
                }
                var index = this._keys.indexOf(key, 0);
                return this._values[index];
            };
            Dictionary.prototype.containsKey = function (key) {
                if (typeof this[key] === "undefined") {
                    return false;
                }
                return true;
            };
            Dictionary.prototype.count = function () {
                return this._keys.length;
            };
            Dictionary.prototype.toLookup = function () {
                return this;
            };
            return Dictionary;
        })();
        Core.Dictionary = Dictionary;
        var KeyValuePair = (function () {
            function KeyValuePair(key, value) {
                this._key = key;
                this._value = value;
            }
            Object.defineProperty(KeyValuePair.prototype, "key", {
                get: function () {
                    return this._key;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(KeyValuePair.prototype, "value", {
                get: function () {
                    return this._value;
                },
                enumerable: true,
                configurable: true
            });
            return KeyValuePair;
        })();
        Core.KeyValuePair = KeyValuePair;
    })(Core = IBE.Core || (IBE.Core = {}));
})(IBE || (IBE = {}));
var IBE;
(function (IBE) {
    var Http;
    (function (Http) {
        var Dictionary = IBE.Core.Dictionary;
        var defer = P.defer;
        var when = P.when;
        (function (HttpMethod) {
            HttpMethod[HttpMethod["GET"] = 0] = "GET";
            HttpMethod[HttpMethod["POST"] = 1] = "POST";
            HttpMethod[HttpMethod["PUT"] = 2] = "PUT";
            HttpMethod[HttpMethod["DELETE"] = 3] = "DELETE";
        })(Http.HttpMethod || (Http.HttpMethod = {}));
        var HttpMethod = Http.HttpMethod;
        (function (ContentType) {
            ContentType[ContentType["Json"] = 0] = "Json";
            ContentType[ContentType["Binary"] = 1] = "Binary";
        })(Http.ContentType || (Http.ContentType = {}));
        var ContentType = Http.ContentType;
        var Uri = (function () {
            function Uri(path) {
                this.IsHttps = false;
                this.Host = "";
                this.Port = 0;
                this.Path = new Array();
                this.Query = new Dictionary();
                this.setPath(path);
            }
            Uri.prototype.setPath = function (path) {
                //remove the starting '/' from the Path
                if (path == "" || typeof (path) == 'undefined')
                    return;
                if (path.charAt(0) == "/") {
                    path = path.slice(1);
                }
                this.Path = path.split("/");
            };
            Uri.prototype.toString = function () {
                var _this = this;
                if ((this.Host == "" && this.Port != 0) || (this.Host != "" && this.Port == 0)) {
                    throw "Either set the host and port or don't. Don't set one without setting the other.";
                }
                var schema = "http";
                var outUrl = "";
                var base = "";
                var path = "";
                var query = "";
                if (this.Host != "") {
                    if (this.IsHttps) {
                        schema = "https";
                    }
                    base = "{0}://{1}:{2}".format(schema, this.Host, this.Port.toString());
                }
                if (this.Path.length > 0) {
                    path = "/" + this.Path.join("/");
                }
                if (typeof this.Query != "undefined") {
                    if (this.Query.count() > 0) {
                        query = "?";
                        query += this.Query.keys().map(function (k) {
                            return k.concat("=").concat(_this.Query.item(k));
                        }).join("&");
                    }
                }
                return base + path + query;
            };
            return Uri;
        })();
        Http.Uri = Uri;
        var HttpHeader = (function () {
            function HttpHeader(key, value) {
                this.value = value;
                this.key = key;
            }
            Object.defineProperty(HttpHeader.prototype, "Key", {
                get: function () {
                    return this.key;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(HttpHeader.prototype, "Value", {
                get: function () {
                    return this.value;
                },
                enumerable: true,
                configurable: true
            });
            return HttpHeader;
        })();
        Http.HttpHeader = HttpHeader;
        var HttpRequest = (function () {
            function HttpRequest() {
                this.Headers = new Array();
                this.ContentType = 0 /* Json */;
            }
            HttpRequest.prototype.addHeader = function (key, value) {
                this.Headers.push(new Http.HttpHeader(key, value));
                return this;
            };
            return HttpRequest;
        })();
        Http.HttpRequest = HttpRequest;
        var HttpTest = (function () {
            function HttpTest() {
            }
            HttpTest.prototype.exec = function (request) {
                this._Request = request;
                return null;
            };
            return HttpTest;
        })();
        Http.HttpTest = HttpTest;
        var HttpRequestFactory = (function () {
            function HttpRequestFactory() {
            }
            HttpRequestFactory.CreateHttpRequest = function () {
                if (typeof _ibe_ios_bridge != "undefined") {
                    // running on mobile
                    if (_ibe_ios_bridge._runMode == "Offline") {
                        return new Http.iosBridgeHttp;
                    }
                    if (_ibe_ios_bridge._runMode == "Connected") {
                        return new Http.jqueryHttp;
                    }
                }
                if (typeof jQuery != "undefined") {
                    return new Http.jqueryHttp;
                }
                if (typeof angular != "undefined") {
                    throw "angular not supported yet as an Http library. Please contact development.";
                }
                throw "Http libraries not found. jQuery and Angular currently supported.";
            };
            return HttpRequestFactory;
        })();
        Http.HttpRequestFactory = HttpRequestFactory;
        var jqueryHttp = (function () {
            function jqueryHttp() {
                if (typeof jQuery == 'undefined') {
                    throw "jQuery not found.";
                }
            }
            jqueryHttp.prototype.exec = function (request) {
                var _this = this;
                this._Request = request;
                var d = defer();
                var ajax = {};
                ajax.type = HttpMethod[this._Request.Method];
                ajax.url = this._Request.Url.toString();
                ajax.dataType = "json";
                if (this._Request.ContentType == 0 /* Json */) {
                    ajax.contentType = 'application/json';
                }
                if (this._Request.ContentType == 1 /* Binary */) {
                    ajax.contentType = 'arraybuffer';
                }
                ajax.data = this._Request.Body;
                ajax.beforeSend = function (request) {
                    var headers = _this._Request.Headers;
                    for (var i = 0; i < headers.length; i++) {
                        var header = headers[i];
                        request.setRequestHeader(header.Key, header.Value);
                    }
                };
                ajax.success = function (data) {
                    d.resolve(data);
                };
                ajax.error = function (err) {
                    if (typeof err.responseJSON != "undefined") {
                        console.log("API AJAX call failed to: " + this.type + " " + this.url + ". Error: " + err.responseJSON.ErrorMessage);
                    }
                    else {
                        console.log("API AJAX call failed to: " + this.type + " " + this.url);
                    }
                    d.reject(err);
                };
                $.ajax(ajax);
                return d.promise();
            };
            return jqueryHttp;
        })();
        Http.jqueryHttp = jqueryHttp;
        var iosBridgeHttp = (function () {
            function iosBridgeHttp() {
                if (typeof _ibe_ios_bridge == 'undefined') {
                    throw "iOSBridge global variable not found.";
                }
            }
            iosBridgeHttp.prototype.exec = function (request) {
                this._Request = request;
                var d = defer();
                var options = { id: 0, query: "", params: {} };
                var url = this._Request.Url;
                if (url.Path[0] == 'api') {
                    // /api/DataCaches/1590/Queries/1210/Exec?state=Alabama
                    options.id = +url.Path[2];
                    options.query = url.Path[4];
                }
                else {
                    // /DataCaches/1590/Queries/1210/Exec?state=Alabama
                    options.id = +url.Path[1];
                    options.query = url.Path[3];
                }
                //parse the query part of the url
                //options.params = {}
                var dict = url.Query; //.toLookup();
                var c = dict.count();
                for (var i = 0; i < c; i++) {
                    var key = dict.keys()[i];
                    options.params[key] = dict.item(key);
                }
                //for (var i = 0; i < url.Query.keys.length; i++) {
                //    options.params[i] = url.Query.values[i];
                //}
                this.bridge_reply = function (data) {
                    d.resolve(data);
                };
                _ibe_ios_bridge.callHandler('cacheQuery', options, this.bridge_reply);
                return d.promise();
            };
            return iosBridgeHttp;
        })();
        Http.iosBridgeHttp = iosBridgeHttp;
    })(Http = IBE.Http || (IBE.Http = {}));
})(IBE || (IBE = {}));
var IBE;
(function (IBE) {
    var Api;
    (function (Api) {
        var Dictionary = IBE.Core.Dictionary;
        var Uri = IBE.Http.Uri;
        var _authToken;
        var HttpRequestor = (function () {
            function HttpRequestor() {
                this.http = IBE.Http.HttpRequestFactory.CreateHttpRequest();
            }
            HttpRequestor.prototype.makeUrl = function (req, url) {
                req.addHeader("Access-Control-Allow-Origin", this.baseUrl);
                //req.Url = this.baseUrl + url;
                req.Url = url;
                //if (this.baseUrl == null || this.baseUrl == "") {
                //	req.Url = url;
                //} else {
                //	req.Url = this.baseUrl + url;
                //}
            };
            HttpRequestor.prototype.getRequest = function (url) {
                var req = new IBE.Http.HttpRequest;
                this.makeUrl(req, url);
                req.Method = 0 /* GET */;
                return req;
            };
            HttpRequestor.prototype.postRequest = function (url, body) {
                var req = new IBE.Http.HttpRequest;
                this.makeUrl(req, url);
                req.Method = 1 /* POST */;
                req.Body = body;
                return req;
            };
            HttpRequestor.prototype.putRequest = function (url, body) {
                var req = new IBE.Http.HttpRequest;
                this.makeUrl(req, url);
                req.Method = 2 /* PUT */;
                req.Body = body;
                return req;
            };
            HttpRequestor.prototype.deleteRequest = function (url) {
                var req = new IBE.Http.HttpRequest;
                this.makeUrl(req, url);
                req.Method = 3 /* DELETE */;
                return req;
            };
            HttpRequestor.prototype.executeRequest = function (req) {
                return this.http.exec(req);
            };
            return HttpRequestor;
        })();
        Api.HttpRequestor = HttpRequestor;
        var Auth = (function (_super) {
            __extends(Auth, _super);
            function Auth(token) {
                _super.call(this);
                if (token == undefined)
                    return;
                _authToken = token;
            }
            Object.defineProperty(Auth.prototype, "AuthToken", {
                get: function () {
                    return _authToken;
                },
                enumerable: true,
                configurable: true
            });
            Auth.prototype.login = function (username, password) {
                var authString = btoa(username + ":" + password);
                ;
                var req = this.postRequest(new Uri("/api/auth"), null);
                req.addHeader("X-IBE-Auth", authString);
                var p = this.executeRequest(req);
                p.done(function (response) {
                    _authToken = response.Token;
                });
                return p;
            };
            Auth.prototype.logoff = function () {
                var req = this.deleteRequest(new Uri("/api/auth"));
                req.addHeader("X-IBE-Token", _authToken);
                return this.executeRequest(req);
            };
            return Auth;
        })(HttpRequestor);
        Api.Auth = Auth;
        var ObjectRetriever = (function (_super) {
            __extends(ObjectRetriever, _super);
            function ObjectRetriever(objectType, authToken) {
                _super.call(this);
                this.objectType = objectType;
                this.authToken = authToken;
            }
            ObjectRetriever.prototype.addAuthHeader = function (req) {
                return req.addHeader("X-IBE-Token", this.authToken);
            };
            ObjectRetriever.prototype.findAll = function () {
                var url;
                if (this.objectType.indexOf("/") > -1) {
                    url = new Uri("/api/{0}".format(this.objectType));
                }
                else {
                    url = new Uri("/api/{0}/".format(this.objectType));
                }
                var req = this.getRequest(url);
                this.addAuthHeader(req);
                return this.executeRequest(req);
            };
            ObjectRetriever.prototype.find = function (objId, action, query) {
                var url;
                if (action) {
                    url = new Uri("/api/{0}/{1}/{2}".format(this.objectType, objId, action));
                }
                else {
                    url = new Uri("/api/{0}/{1}".format(this.objectType, objId));
                }
                url.Query = query;
                var req = this.getRequest(url);
                this.addAuthHeader(req);
                return this.executeRequest(req);
            };
            ObjectRetriever.prototype.add = function (object, objId, action) {
                var url;
                if (action && objId) {
                    url = new Uri("/api/{0}/{1}/{2}".format(this.objectType, objId, action));
                }
                if (action && objId == 0) {
                    url = new Uri("/api/{0}/{1}".format(this.objectType, action));
                }
                if (!action && objId) {
                    url = new Uri("/api/{0}/{1}".format(this.objectType, objId));
                }
                if (action && !objId) {
                    url = new Uri("/api/{0}/{1}".format(this.objectType, action));
                }
                if (!action && !objId) {
                    url = new Uri("/api/{0}/".format(this.objectType));
                    if (this.objectType.indexOf("/") > -1) {
                        url = new Uri("/api/{0}".format(this.objectType));
                    }
                    else {
                        url = new Uri("/api/{0}/".format(this.objectType));
                    }
                }
                var req = this.postRequest(url, object);
                this.addAuthHeader(req);
                return this.executeRequest(req);
            };
            ObjectRetriever.prototype.update = function (objectId, object, action) {
                var url;
                if (action) {
                    url = new Uri("/api/{0}/{1}/{2}".format(this.objectType, objectId, action));
                }
                else {
                    url = new Uri("/api/{0}/{1}".format(this.objectType, objectId));
                }
                var req = this.putRequest(url, object);
                this.addAuthHeader(req);
                return this.executeRequest(req);
            };
            ObjectRetriever.prototype.remove = function (objectId) {
                var req = this.deleteRequest(new Uri("/api/{0}/{1}".format(this.objectType, objectId)));
                this.addAuthHeader(req);
                return this.executeRequest(req);
            };
            return ObjectRetriever;
        })(HttpRequestor);
        Api.ObjectRetriever = ObjectRetriever;
        var Folder = (function (_super) {
            __extends(Folder, _super);
            function Folder(authToken) {
                _super.call(this, "Folders", authToken);
            }
            Folder.prototype.getRoot = function () {
                return _super.prototype.findAll.call(this);
            };
            Folder.prototype.getSubFolders = function (objId) {
                return _super.prototype.find.call(this, objId);
            };
            Folder.prototype.getFiles = function (objId, fileTypes) {
                var urlEnd = fileTypes && "Files?type=" + encodeURIComponent(fileTypes) || "Files";
                return _super.prototype.find.call(this, objId, urlEnd);
            };
            Folder.prototype.add = function (obj) {
                return _super.prototype.add.call(this, obj);
            };
            //update(objId: number, obj: any): P.Promise<any> {
            //    return super.update(objId, obj);
            //}
            Folder.prototype.remove = function (objId) {
                return _super.prototype.remove.call(this, objId);
            };
            return Folder;
        })(ObjectRetriever);
        Api.Folder = Folder;
        var Dashboard = (function (_super) {
            __extends(Dashboard, _super);
            function Dashboard(authToken) {
                _super.call(this, 'Dashboards', authToken);
            }
            Dashboard.prototype.findAll = function () {
                return _super.prototype.findAll.call(this);
            };
            Dashboard.prototype.find = function (objId) {
                return _super.prototype.find.call(this, objId);
            };
            Dashboard.prototype.add = function (obj) {
                return _super.prototype.add.call(this, obj);
            };
            Dashboard.prototype.update = function (objId, obj) {
                return _super.prototype.update.call(this, objId, obj);
            };
            Dashboard.prototype.remove = function (objId) {
                return _super.prototype.remove.call(this, objId);
            };
            Dashboard.prototype.copy = function (objId, obj) {
                return _super.prototype.add.call(this, obj, objId, "Copy");
            };
            Dashboard.prototype.publish = function (objId) {
                return _super.prototype.add.call(this, null, objId, "Publish");
            };
            Dashboard.prototype.publishImage = function (objId, obj) {
                return _super.prototype.add.call(this, obj, objId, "Publish/Image");
            };
            Dashboard.prototype.export = function (objId) {
                return _super.prototype.find.call(this, objId, "Export");
            };
            Dashboard.prototype.exportlink = function (objId) {
                return _super.prototype.find.call(this, objId, "ExportLink");
            };
            Dashboard.prototype.import = function (obj) {
                return _super.prototype.add.call(this, obj, 0, "Import");
            };
            return Dashboard;
        })(ObjectRetriever);
        Api.Dashboard = Dashboard;
        var DashboardComponent = (function (_super) {
            __extends(DashboardComponent, _super);
            function DashboardComponent(authToken, dashboardId) {
                _super.call(this, 'Dashboards/' + dashboardId + '/Components', authToken);
            }
            DashboardComponent.prototype.findAll = function () {
                return _super.prototype.findAll.call(this);
            };
            DashboardComponent.prototype.find = function (objId) {
                return _super.prototype.find.call(this, objId);
            };
            DashboardComponent.prototype.add = function (obj) {
                return _super.prototype.add.call(this, obj);
            };
            DashboardComponent.prototype.update = function (objId, obj) {
                return _super.prototype.update.call(this, objId, obj);
            };
            DashboardComponent.prototype.remove = function (objId) {
                return _super.prototype.remove.call(this, objId);
            };
            return DashboardComponent;
        })(ObjectRetriever);
        Api.DashboardComponent = DashboardComponent;
        var DashboardDataBlock = (function (_super) {
            __extends(DashboardDataBlock, _super);
            function DashboardDataBlock(authToken, dashboardId) {
                _super.call(this, 'Dashboards/' + dashboardId + '/DataBlocks', authToken);
            }
            DashboardDataBlock.prototype.findAll = function () {
                return _super.prototype.findAll.call(this);
            };
            DashboardDataBlock.prototype.find = function (objId) {
                return _super.prototype.find.call(this, objId);
            };
            DashboardDataBlock.prototype.add = function (obj) {
                return _super.prototype.add.call(this, obj);
            };
            DashboardDataBlock.prototype.update = function (objId, obj) {
                return _super.prototype.update.call(this, objId, obj);
            };
            DashboardDataBlock.prototype.remove = function (objId) {
                return _super.prototype.remove.call(this, objId);
            };
            return DashboardDataBlock;
        })(ObjectRetriever);
        Api.DashboardDataBlock = DashboardDataBlock;
        var DashboardSnapshot = (function (_super) {
            __extends(DashboardSnapshot, _super);
            function DashboardSnapshot(authToken, dashboardId) {
                _super.call(this, 'Dashboards/' + dashboardId + '/Snapshots', authToken);
            }
            DashboardSnapshot.prototype.findAll = function () {
                return _super.prototype.findAll.call(this);
            };
            DashboardSnapshot.prototype.find = function (objId) {
                return _super.prototype.find.call(this, objId);
            };
            DashboardSnapshot.prototype.add = function (obj) {
                return _super.prototype.add.call(this, obj);
            };
            DashboardSnapshot.prototype.update = function (objId, obj) {
                return _super.prototype.update.call(this, objId, obj);
            };
            DashboardSnapshot.prototype.remove = function (objId) {
                return _super.prototype.remove.call(this, objId);
            };
            return DashboardSnapshot;
        })(ObjectRetriever);
        Api.DashboardSnapshot = DashboardSnapshot;
        var LayoutTemplate = (function (_super) {
            __extends(LayoutTemplate, _super);
            function LayoutTemplate(authToken) {
                _super.call(this, 'LayoutTemplates', authToken);
            }
            LayoutTemplate.prototype.findAll = function () {
                return _super.prototype.findAll.call(this);
            };
            LayoutTemplate.prototype.find = function (objId) {
                return _super.prototype.find.call(this, objId);
            };
            LayoutTemplate.prototype.add = function (obj) {
                return _super.prototype.add.call(this, obj);
            };
            LayoutTemplate.prototype.update = function (objId, obj) {
                return _super.prototype.update.call(this, objId, obj);
            };
            LayoutTemplate.prototype.remove = function (objId) {
                return _super.prototype.remove.call(this, objId);
            };
            return LayoutTemplate;
        })(ObjectRetriever);
        Api.LayoutTemplate = LayoutTemplate;
        var ColorSet = (function (_super) {
            __extends(ColorSet, _super);
            function ColorSet(authToken) {
                _super.call(this, 'ColorSets', authToken);
            }
            ColorSet.prototype.findAll = function () {
                return _super.prototype.findAll.call(this);
            };
            ColorSet.prototype.find = function (objId) {
                return _super.prototype.find.call(this, objId);
            };
            ColorSet.prototype.add = function (obj) {
                return _super.prototype.add.call(this, obj);
            };
            ColorSet.prototype.update = function (objId, obj) {
                return _super.prototype.update.call(this, objId, obj);
            };
            ColorSet.prototype.remove = function (objId) {
                return _super.prototype.remove.call(this, objId);
            };
            return ColorSet;
        })(ObjectRetriever);
        Api.ColorSet = ColorSet;
        var Database = (function (_super) {
            __extends(Database, _super);
            function Database(authToken) {
                _super.call(this, 'Databases', authToken);
            }
            Database.prototype.findAll = function () {
                return _super.prototype.findAll.call(this);
            };
            Database.prototype.find = function (dbConnId) {
                return _super.prototype.find.call(this, dbConnId);
            };
            Database.prototype.test = function (dbConnId) {
                return _super.prototype.find.call(this, dbConnId, "Test");
            };
            Database.prototype.add = function (dbConn) {
                return _super.prototype.add.call(this, dbConn);
            };
            Database.prototype.update = function (dbConnId, dbConn) {
                return _super.prototype.update.call(this, dbConnId, dbConn);
            };
            Database.prototype.remove = function (dbConnId) {
                return _super.prototype.remove.call(this, dbConnId);
            };
            return Database;
        })(ObjectRetriever);
        Api.Database = Database;
        var DatabaseQuery = (function (_super) {
            __extends(DatabaseQuery, _super);
            function DatabaseQuery(authToken, dbConnId) {
                _super.call(this, 'Databases/' + dbConnId + '/Queries', authToken);
            }
            DatabaseQuery.prototype.findAll = function () {
                return _super.prototype.findAll.call(this);
            };
            DatabaseQuery.prototype.find = function (queryId) {
                return _super.prototype.find.call(this, queryId);
            };
            DatabaseQuery.prototype.exec = function (queryId, params) {
                return _super.prototype.find.call(this, queryId, "Exec", params);
            };
            DatabaseQuery.prototype.add = function (query) {
                return _super.prototype.add.call(this, query);
            };
            DatabaseQuery.prototype.update = function (queryId, query) {
                return _super.prototype.update.call(this, queryId, query);
            };
            DatabaseQuery.prototype.remove = function (queryId) {
                return _super.prototype.remove.call(this, queryId);
            };
            return DatabaseQuery;
        })(ObjectRetriever);
        Api.DatabaseQuery = DatabaseQuery;
        var QueryParameters = (function (_super) {
            __extends(QueryParameters, _super);
            function QueryParameters() {
                _super.apply(this, arguments);
            }
            QueryParameters.prototype.add = function (key, value) {
                _super.prototype.add.call(this, key, value);
            };
            QueryParameters.prototype.toString = function () {
                var pairs = [];
                var dict = _super.prototype.toLookup.call(this);
                var c = dict.count();
                for (var i = 0; i < c; i++) {
                    var key = dict.keys()[i];
                    pairs.push(encodeURIComponent(key) + "=" + encodeURIComponent(dict.item(key)));
                }
                return "?" + pairs.join("&");
            };
            return QueryParameters;
        })(Dictionary);
        Api.QueryParameters = QueryParameters;
        var DataCache = (function (_super) {
            __extends(DataCache, _super);
            function DataCache(authToken) {
                _super.call(this, 'DataCaches', authToken);
            }
            DataCache.prototype.findAll = function () {
                return _super.prototype.findAll.call(this);
            };
            DataCache.prototype.find = function (objId) {
                return _super.prototype.find.call(this, objId);
            };
            DataCache.prototype.findMeta = function (objId) {
                var req = this.getRequest(new Uri("/api/{0}/{1}/Meta".format(this.objectType, objId)));
                this.addAuthHeader(req);
                return this.executeRequest(req);
            };
            return DataCache;
        })(ObjectRetriever);
        Api.DataCache = DataCache;
        var DataCacheQuery = (function (_super) {
            __extends(DataCacheQuery, _super);
            function DataCacheQuery(authToken, objId) {
                _super.call(this, 'DataCaches/' + objId + '/Queries', authToken);
            }
            DataCacheQuery.prototype.findAll = function () {
                return _super.prototype.findAll.call(this);
            };
            DataCacheQuery.prototype.find = function (objId) {
                return _super.prototype.find.call(this, objId);
            };
            DataCacheQuery.prototype.findMeta = function (objId) {
                var req = this.getRequest(new Uri("/api/{0}/{1}/Meta".format(this.objectType, objId)));
                this.addAuthHeader(req);
                return this.executeRequest(req);
            };
            DataCacheQuery.prototype.exec = function (queryId, params) {
                return _super.prototype.find.call(this, queryId, "Exec", params);
            };
            DataCacheQuery.prototype.add = function (obj) {
                return _super.prototype.add.call(this, obj);
            };
            DataCacheQuery.prototype.addMeta = function (obj) {
                var req = this.postRequest(new Uri("/api/{0}/Meta".format(this.objectType)), obj);
                this.addAuthHeader(req);
                return this.executeRequest(req);
            };
            DataCacheQuery.prototype.update = function (objId, obj) {
                return _super.prototype.update.call(this, objId, obj);
            };
            DataCacheQuery.prototype.updateMeta = function (objId, obj) {
                var req = this.putRequest(new Uri("/api/{0}/{1}/Meta".format(this.objectType, objId)), obj);
                this.addAuthHeader(req);
                return this.executeRequest(req);
            };
            DataCacheQuery.prototype.remove = function (objId) {
                return _super.prototype.remove.call(this, objId);
            };
            return DataCacheQuery;
        })(ObjectRetriever);
        Api.DataCacheQuery = DataCacheQuery;
        var MultiColumnList = (function (_super) {
            __extends(MultiColumnList, _super);
            function MultiColumnList(authToken) {
                _super.call(this, 'MultiColumnLists', authToken);
            }
            MultiColumnList.prototype.findAll = function () {
                return _super.prototype.findAll.call(this);
            };
            MultiColumnList.prototype.find = function (objId) {
                return _super.prototype.find.call(this, objId);
            };
            MultiColumnList.prototype.add = function (obj) {
                return _super.prototype.add.call(this, obj);
            };
            MultiColumnList.prototype.update = function (objId, obj) {
                return _super.prototype.update.call(this, objId, obj);
            };
            MultiColumnList.prototype.remove = function (objId) {
                return _super.prototype.remove.call(this, objId);
            };
            return MultiColumnList;
        })(ObjectRetriever);
        Api.MultiColumnList = MultiColumnList;
        var Report = (function (_super) {
            __extends(Report, _super);
            function Report(authToken) {
                _super.call(this, 'Reports', authToken);
            }
            Report.prototype.findAll = function () {
                return _super.prototype.findAll.call(this);
            };
            Report.prototype.find = function (objId) {
                return _super.prototype.find.call(this, objId);
            };
            Report.prototype.add = function (obj) {
                return _super.prototype.add.call(this, obj);
            };
            Report.prototype.update = function (objId, obj) {
                return _super.prototype.update.call(this, objId, obj);
            };
            Report.prototype.remove = function (objId) {
                return _super.prototype.remove.call(this, objId);
            };
            return Report;
        })(ObjectRetriever);
        Api.Report = Report;
        var ReportTab = (function (_super) {
            __extends(ReportTab, _super);
            function ReportTab(authToken, reportId) {
                _super.call(this, 'Reports/' + reportId + '/Tabs', authToken);
            }
            ReportTab.prototype.findAll = function () {
                return _super.prototype.findAll.call(this);
            };
            ReportTab.prototype.find = function (objId) {
                return _super.prototype.find.call(this, objId);
            };
            ReportTab.prototype.add = function (obj) {
                return _super.prototype.add.call(this, obj);
            };
            ReportTab.prototype.update = function (objId, obj) {
                return _super.prototype.update.call(this, objId, obj);
            };
            ReportTab.prototype.remove = function (objId) {
                return _super.prototype.remove.call(this, objId);
            };
            return ReportTab;
        })(ObjectRetriever);
        Api.ReportTab = ReportTab;
        var ReportDataBlock = (function (_super) {
            __extends(ReportDataBlock, _super);
            function ReportDataBlock(authToken, reportId) {
                _super.call(this, 'Reports/' + reportId + '/DataBlocks', authToken);
            }
            ReportDataBlock.prototype.findAll = function () {
                return _super.prototype.findAll.call(this);
            };
            ReportDataBlock.prototype.find = function (objId) {
                return _super.prototype.find.call(this, objId);
            };
            ReportDataBlock.prototype.add = function (obj) {
                return _super.prototype.add.call(this, obj);
            };
            ReportDataBlock.prototype.update = function (objId, obj) {
                return _super.prototype.update.call(this, objId, obj);
            };
            ReportDataBlock.prototype.remove = function (objId) {
                return _super.prototype.remove.call(this, objId);
            };
            return ReportDataBlock;
        })(ObjectRetriever);
        Api.ReportDataBlock = ReportDataBlock;
        var Universe = (function (_super) {
            __extends(Universe, _super);
            function Universe(authToken) {
                _super.call(this, 'Universe', authToken);
            }
            Universe.prototype.findAll = function () {
                return _super.prototype.findAll.call(this);
            };
            Universe.prototype.find = function (objId) {
                return _super.prototype.find.call(this, objId);
            };
            Universe.prototype.add = function (obj) {
                return _super.prototype.add.call(this, obj);
            };
            Universe.prototype.update = function (objId, obj) {
                return _super.prototype.update.call(this, objId, obj);
            };
            Universe.prototype.remove = function (objId) {
                return _super.prototype.remove.call(this, objId);
            };
            return Universe;
        })(ObjectRetriever);
        Api.Universe = Universe;
        var Log = (function (_super) {
            __extends(Log, _super);
            function Log(authToken) {
                _super.call(this, 'Log/Api', authToken);
            }
            Log.prototype.log = function (logEntry) {
                return _super.prototype.add.call(this, logEntry);
            };
            return Log;
        })(ObjectRetriever);
        Api.Log = Log;
    })(Api = IBE.Api || (IBE.Api = {}));
})(IBE || (IBE = {}));
/// <reference path="libs/String-Extensions.ts" />
/// <reference path="libs/jquery.d.ts" />
/// <reference path="libs/angular.d.ts" />
/// <reference path="libs/Promise.ts" />
/// <reference path="ibe.http.ts" />
/// <reference path="ibe.api.ts" />
