/// <reference path="./reference.ts"/>
var IBE;
(function (IBE) {
    var Api;
    (function (Api) {
        var Http;
        (function (Http) {
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
                    this.Query = new Api.QueryParameters();
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
                            query += this.Query._keys.map(function (k) {
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
                    for (var i = 0; i < url.Query.keys.length; i++) {
                        options.params[i] = url.Query.values[i];
                    }
                    this.bridge_reply = function (data) {
                        d.resolve(data);
                    };
                    _ibe_ios_bridge.callHandler('cacheQuery', options, this.bridge_reply);
                    return d.promise();
                };
                return iosBridgeHttp;
            })();
            Http.iosBridgeHttp = iosBridgeHttp;
        })(Http = Api.Http || (Api.Http = {}));
    })(Api = IBE.Api || (IBE.Api = {}));
})(IBE || (IBE = {}));
