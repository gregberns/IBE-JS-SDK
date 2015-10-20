/// <reference path="./_references.ts"/>
/// <reference path="./ibe.http.ts"/>
"use strict";

module IBE.Core {

    export interface IDictionary {
        add(key: string, value: any): void;
        update(key: string, value: any): void;
        remove(key: string): void;
        item(key: string);
        containsKey(key: string): boolean;
        count(): number;
        keys(): string[];
        values(): any[];
    }

    export class Dictionary implements IDictionary {

        _keys: string[] = new Array<string>();
        _values: any[] = new Array<any>();

        constructor(init?: { key: string; value: any; }[]) {
            if (typeof init === "undefined" || init == null) return;
            for (var x = 0; x < init.length; x++) {
                this[init[x].key] = init[x].value;
                this._keys.push(init[x].key);
                this._values.push(init[x].value);
            }
        }

        add(key: string, value: any) {
            this[key] = value;
            this._keys.push(key);
            this._values.push(value);
        }

        update(key: string, value: any) {
            if (!this.containsKey(key)) {
                throw "Dictionary does not contain key with value of: " + key;
            }
            var index = this._keys.indexOf(key, 0);
            this._values[index] = value;
        }

        remove(key: string) {
            var index = this._keys.indexOf(key, 0);
            this._keys.splice(index, 1);
            this._values.splice(index, 1);

            delete this[key];
        }

        keys(): string[] {
            return this._keys;
        }

        values(): any[] {
            return this._values;
        }

        item(key: string) {
            if (!this.containsKey(key)) {
                throw "Dictionary does not contain key with value of: " + key;
            }
            var index = this._keys.indexOf(key, 0);
            return this._values[index];
        }

        containsKey(key: string) {
            if (typeof this[key] === "undefined") {
                return false;
            }

            return true;
        }

        count(): number {
            return this._keys.length;
        }

        toLookup(): IDictionary {
            return this;
        }
    }

    export class KeyValuePair<TKey, TValue> {

        private _key: TKey;
        private _value: TValue;

        constructor(key: TKey, value: TValue) {
            this._key = key;
            this._value = value;
        }

        get key(): TKey {
            return this._key;
        }

        get value(): TValue {
            return this._value;
        }
    }
}

module IBE.Http {

    import Dictionary = IBE.Core.Dictionary;
    import IDictionary = IBE.Core.IDictionary;

    declare var _ibe_ios_bridge: any;

    var defer = P.defer;
    var when = P.when;
    export interface Promise<Value> extends P.Promise<Value> { }

    export enum HttpMethod {
        GET,
        POST,
        PUT,
        DELETE
    }

    export enum ContentType {
        Json,
        Binary
    }

    export class Uri {

        constructor(path?: string) {
            this.Host = "";
            this.Port = 0;
            this.Path = new Array<string>();
            this.Query = new Dictionary();

            this.setPath(path);
        }

        IsHttps: boolean = false;
        Host: string;
        Port: number;
        Path: Array<string>;
        Query: IDictionary;

        setPath(path: string) {
            //remove the starting '/' from the Path
            if (path == "" || typeof (path) == 'undefined') return;
            if (path.charAt(0) == "/") {
                path = path.slice(1);
            }
            this.Path = path.split("/");
        }

        toString(): string {

            if ((this.Host == "" && this.Port != 0) ||
                (this.Host != "" && this.Port == 0)) {
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
                    query += this.Query.keys().map((k) => {
                        return k.concat("=").concat(this.Query.item(k));
                    }).join("&");
                }
            }

            return base + path + query;
        }

    }

    export class HttpHeader {

        private key: string;
        private value: string;

        constructor(key: string, value: string) {
            this.value = value;
            this.key = key;
        }

        get Key(): string {
            return this.key;
        }
        get Value(): string {
            return this.value;
        }
    }

    export interface IHttpRequest {

        Url: Uri;
        Method: HttpMethod;
        Headers: HttpHeader[];
        Body: any;

        addHeader(key: string, value: string): void;

    }

    export class HttpRequest implements IHttpRequest {

        Url: Uri;
        Method: HttpMethod;
        Headers: HttpHeader[];
        Body: any;
        ContentType: ContentType;

        constructor() {
            this.Headers = new Array<HttpHeader>();
            this.ContentType = ContentType.Json;
        }

        addHeader(key: string, value: string): HttpRequest {
            this.Headers.push(new Http.HttpHeader(key, value));
            return this;
        }
    }

    export interface IHttp {

        exec(request: HttpRequest): P.Promise<any>;

    }

    export class HttpTest implements IHttp {

        _Request: HttpRequest;

        exec(request: HttpRequest): P.Promise<any> {
            this._Request = request;

            return null;
        }

    }

    export class HttpRequestFactory {

        static CreateHttpRequest(): IHttp {

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
                throw "AngularJS not supported yet as an Http library. Please contact development.";
            }

            throw "Http libraries not found. jQuery and Angular currently supported.";
        }
    }

    export class jqueryHttp implements IHttp {

        _Request: HttpRequest;

        constructor() {
            if (typeof jQuery == 'undefined') {
                throw "jQuery not found.";
            }
        }

        exec(request: HttpRequest): P.Promise<any> {
            this._Request = request;

            var d = defer<any>();
            var ajax: any = {};

            ajax.type = HttpMethod[this._Request.Method];
            ajax.url = this._Request.Url.toString();
            ajax.dataType = "json";

            if (this._Request.ContentType == ContentType.Json) {
                ajax.contentType = 'application/json';
            } if (this._Request.ContentType == ContentType.Binary) {
                ajax.contentType = 'arraybuffer';
            }

            ajax.data = this._Request.Body;

            ajax.beforeSend = (request) => {
                var headers = this._Request.Headers;
                for (var i = 0; i < headers.length; i++) {
                    var header = headers[i];
                    request.setRequestHeader(header.Key, header.Value);
                }
            };

            ajax.success = (data) => {
                d.resolve(data);
            };

            ajax.error = function (err) {
                if (typeof err.responseJSON != "undefined") {
                    console.log("API AJAX call failed to: " + this.type + " " + this.url + ". Error: " + err.responseJSON.ErrorMessage);
                } else {
                    console.log("API AJAX call failed to: " + this.type + " " + this.url);
                }
                d.reject(err);
            };

            $.ajax(ajax);

            return d.promise();
        }
    }

    export class iosBridgeHttp implements IHttp {

        _Request: HttpRequest;
        bridge_reply: any;

        constructor() {
            if (typeof _ibe_ios_bridge == 'undefined') {
                throw "iOSBridge global variable not found.";
            }
        }

        exec(request: HttpRequest): P.Promise<any> {
            this._Request = request;
            var d = defer<any>();

            var options = { id: 0, query: "", params: {} };
            var url = this._Request.Url;

            if (url.Path[0] == 'api') {
                // /api/DataCaches/1590/Queries/1210/Exec?state=Alabama
                options.id = +url.Path[2];
                options.query = url.Path[4];
            } else {
                // /DataCaches/1590/Queries/1210/Exec?state=Alabama
                options.id = +url.Path[1];
                options.query = url.Path[3];
            }

            //parse the query part of the url
            //options.params = {}
            var dict = url.Query;//.toLookup();
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
            }

            _ibe_ios_bridge.callHandler('cacheQuery', options, this.bridge_reply);

            return d.promise();

        }
    }
}


module IBE.Api {

    import Dictionary = IBE.Core.Dictionary;
    import IDictionary = IBE.Core.IDictionary;

    import Uri = IBE.Http.Uri;

    //HttpRequest declaration has to be before Uri for some reason
    import HttpRequest = IBE.Http.HttpRequest;
    
    
    var _authToken: string;
    
	export class HttpRequestor {
		
		public baseUrl: string;

		private http: Http.IHttp;

		constructor() {
			this.http = Http.HttpRequestFactory.CreateHttpRequest();   
		}

		private makeUrl(req: HttpRequest, url: Uri) {
			req.addHeader("Access-Control-Allow-Origin", this.baseUrl);
			req.Url = url;
		}

		getRequest(url: Uri): Http.HttpRequest {
			var req = new Http.HttpRequest;

			this.makeUrl(req, url);
			req.Method = Http.HttpMethod.GET;
			
			return req;
		}
        postRequest(url: Uri, body: any): Http.HttpRequest {
			var req = new Http.HttpRequest;

			this.makeUrl(req, url);
			req.Method = Http.HttpMethod.POST;
			req.Body = body;

			return req;
		}
        putRequest(url: Uri, body: any): Http.HttpRequest {
			var req = new Http.HttpRequest;
			
			this.makeUrl(req, url);
			req.Method = Http.HttpMethod.PUT;
			req.Body = body;

			return req;
		}
        deleteRequest(url: Uri): Http.HttpRequest {
			var req = new Http.HttpRequest;

			this.makeUrl(req, url);
			req.Method = Http.HttpMethod.DELETE;
			
			return req;
		}

		executeRequest(req: Http.HttpRequest): P.Promise<any> {
			return this.http.exec(req);
		}
				
	}

	export class Auth extends HttpRequestor {

		constructor(token: string) {
			super();
			if (token == undefined) return;
			_authToken = token;
		}

		public get AuthToken(): string {
			return _authToken;
		}
		
		login(username: string, password: string): P.Promise<any> {

			var authString: string = btoa(username + ":" + password);;
			var req = this.postRequest(new Uri("/api/auth"), null);
			req.addHeader("X-IBE-Auth", authString);

			var p = this.executeRequest(req);
			p.done((response) => {
					_authToken = response.Token;
				});

			return p;
		}

		logoff() {
			var req = this.deleteRequest(new Uri("/api/auth"));
			req.addHeader("X-IBE-Token", _authToken);
			return this.executeRequest(req);
		}

	}

	export interface IObjectRetriever  {
		findAll();
		find(objectId: number);
		add(item: any);
		update(objectId: number, item: any);
		remove(objectId: number);
	}

	export class ObjectRetriever extends HttpRequestor implements IObjectRetriever {

		public objectType: string;
		private authToken;

		constructor(objectType: string, authToken: string) {
			super();
			this.objectType = objectType;
			this.authToken = authToken;
		}

		addAuthHeader(req: Http.HttpRequest): Http.HttpRequest {
			return req.addHeader("X-IBE-Token", this.authToken);
		}

		findAll(): P.Promise<any> {
			var url: Uri;
			if (this.objectType.indexOf("/") > -1) {
                url = new Uri("/api/{0}".format(this.objectType));
			} else {
                url = new Uri("/api/{0}/".format(this.objectType));
			}
			var req = this.getRequest(url);
			this.addAuthHeader(req);
			return this.executeRequest(req);
		}
        find(objId: number, action?: string, query?: Dictionary): P.Promise<any> {
            var url: Uri;
            if (action) {
                url = new Uri("/api/{0}/{1}/{2}".format(this.objectType, objId, action));
            } else {
				url = new Uri("/api/{0}/{1}".format(this.objectType, objId));
            }
		    url.Query = query;
			var req =  this.getRequest(url);
			this.addAuthHeader(req);
			return this.executeRequest(req);
        }
	    add(object: any, objId?: number, action?: string): P.Promise<any> {
			var url: Uri;
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
				} else {
                    url = new Uri("/api/{0}/".format(this.objectType));
				}
			}
			var req =  this.postRequest(url,  object);
			this.addAuthHeader(req);
			return this.executeRequest(req);
		}
		update(objectId: number, object: any, action?: string): P.Promise<any> {
			var url: Uri;
			if (action) {
				url = new Uri("/api/{0}/{1}/{2}".format(this.objectType, objectId, action));
			} else {
				url = new Uri("/api/{0}/{1}".format(this.objectType, objectId));
			}
			var req = this.putRequest(url, object);
			this.addAuthHeader(req);
			return this.executeRequest(req);
		}

		remove(objectId: number): P.Promise<any> {
			var req = this.deleteRequest(new Uri("/api/{0}/{1}".format(this.objectType, objectId)));
			this.addAuthHeader(req);
			return this.executeRequest(req);
		}
	}
    

	export class Folder extends ObjectRetriever {

		constructor(authToken: string) {
			super("Folders", authToken);
		}

		getRoot(): P.Promise<any> {
			return super.findAll();
		}
		getSubFolders(objId: number): P.Promise<any> {
			return super.find(objId);
		}
		getFiles(objId: number, fileTypes?: string): P.Promise<any> {
			var urlEnd = fileTypes && "Files?type=" + encodeURIComponent(fileTypes) || "Files";
			return super.find(objId, urlEnd);
		}
		add(obj: any): P.Promise<any> {
			return super.add(obj);
		}
		//update(objId: number, obj: any): P.Promise<any> {
		//    return super.update(objId, obj);
		//}
		remove(objId: number): P.Promise<any> {
			return super.remove(objId);
		}
	}
    
	export class Dashboard extends ObjectRetriever {

		constructor(authToken: string) {
			super('Dashboards', authToken);
		}

		findAll(): P.Promise<any> {
			return super.findAll();
		}
		find(objId: number): P.Promise<any> {
			return super.find(objId);
		}
		add(obj: any): P.Promise<any> {
			return super.add(obj);
		}
		update(objId: number, obj: any): P.Promise<any> {
			return super.update(objId, obj);
		}
		remove(objId: number): P.Promise<any> {
			return super.remove(objId);
		}
        
        copy(objId: number, obj: any): P.Promise<any> {
            return super.add(obj, objId, "Copy");
        }

        publish(objId: number): P.Promise<any> {
			return super.add(null, objId, "Publish");
		}
		publishImage(objId: number, obj: any): P.Promise<any> {
			return super.add(obj, objId, "Publish/Image");
        }

        export(objId: number): P.Promise<any> {
            return super.find(objId, "Export");
        }
        exportlink(objId: number): P.Promise<any> {
            return super.find(objId, "ExportLink");
        }
        import(obj: any): P.Promise<any> {
            return super.add(obj, 0, "Import");
        }
	}

	export class DashboardComponent extends ObjectRetriever {

		constructor(authToken: string, dashboardId: number) {
			super('Dashboards/'+dashboardId+'/Components', authToken);
		}

		findAll(): P.Promise<any> {
			return super.findAll();
		}
		find(objId: number): P.Promise<any> {
			return super.find(objId);
		}
		add(obj: any): P.Promise<any> {
			return super.add(obj);
		}
		update(objId: number, obj: any): P.Promise<any> {
			return super.update(objId, obj);
		}
		remove(objId: number): P.Promise<any> {
			return super.remove(objId);
		}
	}

	export class DashboardDataBlock extends ObjectRetriever {

		constructor(authToken: string, dashboardId: number) {
			super('Dashboards/'+dashboardId+'/DataBlocks', authToken);
		}

		findAll(): P.Promise<any> {
			return super.findAll();
		}
		find(objId: number): P.Promise<any> {
			return super.find(objId);
		}
		add(obj: any): P.Promise<any> {
			return super.add(obj);
		}
		update(objId: number, obj: any): P.Promise<any> {
			return super.update(objId, obj);
		}
		remove(objId: number): P.Promise<any> {
			return super.remove(objId);
		}
	}

	export class DashboardSnapshot extends ObjectRetriever {

		constructor(authToken: string, dashboardId: number) {
			super('Dashboards/' + dashboardId + '/Snapshots', authToken);
		}

		findAll(): P.Promise<any> {
			return super.findAll();
		}
		find(objId: number): P.Promise<any> {
			return super.find(objId);
		}
		add(obj: any): P.Promise<any> {
			return super.add(obj);
		}
		update(objId: number, obj: any): P.Promise<any> {
			return super.update(objId, obj);
		}
		remove(objId: number): P.Promise<any> {
			return super.remove(objId);
		}
	}
	
	export class LayoutTemplate extends ObjectRetriever {

		constructor(authToken: string) {
			super('LayoutTemplates', authToken);
		}

		findAll(): P.Promise<any> {
			return super.findAll();
		}
		find(objId: number): P.Promise<any> {
			return super.find(objId);
		}
		add(obj: any): P.Promise<any> {
			return super.add(obj);
		}
		update(objId: number, obj: any): P.Promise<any> {
			return super.update(objId, obj);
		}
		remove(objId: number): P.Promise<any> {
			return super.remove(objId);
		}
	}

	export class ColorSet extends ObjectRetriever {

		constructor(authToken: string) {
			super('ColorSets', authToken);
		}

		findAll(): P.Promise<any> {
			return super.findAll();
		}
		find(objId: number): P.Promise<any> {
			return super.find(objId);
		}
		add(obj: any): P.Promise<any> {
			return super.add(obj);
		}
		update(objId: number, obj: any): P.Promise<any> {
			return super.update(objId, obj);
		}
		remove(objId: number): P.Promise<any> {
			return super.remove(objId);
		}
	}


	export class Database extends ObjectRetriever {

		constructor(authToken: string) {
			super('Databases', authToken);
		}

		findAll(): P.Promise<any> {
			return super.findAll();
		}
		find(dbConnId: number): P.Promise<any> {
			return super.find(dbConnId);
		}
		test(dbConnId: number): P.Promise<any> {
			return super.find(dbConnId, "Test");
		}
		add(dbConn: any): P.Promise<any> {
			return super.add(dbConn);
		}
		update(dbConnId: number, dbConn: any): P.Promise<any> {
			return super.update(dbConnId, dbConn);
		}
		remove(dbConnId: number): P.Promise<any> {
			return super.remove(dbConnId);
		}
	}

	export class DatabaseQuery extends ObjectRetriever {

		constructor(authToken: string, dbConnId) {
			super('Databases/'+ dbConnId +'/Queries', authToken);
		}

		findAll(): P.Promise<any> {
			return super.findAll();
		}
		find(queryId: number): P.Promise<any> {
			return super.find(queryId);
		}
		exec(queryId: number, params?: QueryParameters): P.Promise<any> {
            return super.find(queryId, "Exec", params);
		}
		add(query: any): P.Promise<any> {
			return super.add(query);
		}
		update(queryId: number, query: any): P.Promise<any> {
			return super.update(queryId, query);
		}
		remove(queryId: number): P.Promise<any> {
			return super.remove(queryId);
		}
	}

    export class QueryParameters extends Dictionary {

        add(key: string, value: any) {
            super.add(key, value);
        }

        toString(): string {
            var pairs = [];
            var dict = super.toLookup();
            var c = dict.count();
            for (var i=0; i < c; i++) {
                var key = dict.keys()[i];
                pairs.push(encodeURIComponent(key) + "=" + encodeURIComponent(dict.item(key)));
            }

            return "?" + pairs.join("&");
        }
    }

	export class DataCache extends ObjectRetriever {

		constructor(authToken: string) {
			super('DataCaches', authToken);
		}

		findAll(): P.Promise<any> {
			return super.findAll();
		}
		find(objId: number): P.Promise<any> {
			return super.find(objId);
		}
		findMeta(objId: number): P.Promise<any> {
			var req = this.getRequest(new Uri("/api/{0}/{1}/Meta".format(this.objectType, objId)));
			this.addAuthHeader(req);
			return this.executeRequest(req);
		}
		//add(obj: any): P.Promise<any> {
		//    return super.add(obj);
		//}
		//update(objId: number, obj: any): P.Promise<any> {
		//    return super.update(objId, obj);
		//}
		//remove(objId: number): P.Promise<any> {
		//    return super.remove(objId);
		//}
	}

	export class DataCacheQuery extends ObjectRetriever {

		constructor(authToken: string, objId: number) {
			super('DataCaches/' + objId + '/Queries', authToken);
		}

		findAll(): P.Promise<any> {
			return super.findAll();
		}
		find(objId: number): P.Promise<any> {
			return super.find(objId);
		}
		findMeta(objId: number): P.Promise<any> {
			var req = this.getRequest(new Uri("/api/{0}/{1}/Meta".format(this.objectType, objId)));
			this.addAuthHeader(req);
			return this.executeRequest(req);
		}
		exec(queryId: number, params?: QueryParameters): P.Promise<any> {
			return super.find(queryId, "Exec", params);
		}
		add(obj: any): P.Promise<any> {
			return super.add(obj);
		}
		addMeta(obj: any): P.Promise<any> {
			var req = this.postRequest(new Uri("/api/{0}/Meta".format(this.objectType)), obj);
			this.addAuthHeader(req);
			return this.executeRequest(req);
		}
		update(objId: number, obj: any): P.Promise<any> {
			return super.update(objId, obj);
		}
		updateMeta(objId: number, obj: any): P.Promise<any> {
			var req = this.putRequest(new Uri("/api/{0}/{1}/Meta".format(this.objectType, objId)), obj);
			this.addAuthHeader(req);
			return this.executeRequest(req);
		}
		remove(objId: number): P.Promise<any> {
			return super.remove(objId);
		}
	}

	export class MultiColumnList extends ObjectRetriever {

		constructor(authToken: string) {
			super('MultiColumnLists', authToken);
		}

		findAll(): P.Promise<any> {
			return super.findAll();
		}
		find(objId: number): P.Promise<any> {
			return super.find(objId);
		}
		add(obj: any): P.Promise<any> {
			return super.add(obj);
		}
		update(objId: number, obj: any): P.Promise<any> {
			return super.update(objId, obj);
		}
		remove(objId: number): P.Promise<any> {
			return super.remove(objId);
		}
    }


	export class Report extends ObjectRetriever {

		constructor(authToken: string) {
			super('Reports', authToken);
		}

		findAll(): P.Promise<any> {
			return super.findAll();
		}
		find(objId: number): P.Promise<any> {
			return super.find(objId);
		}
		add(obj: any): P.Promise<any> {
			return super.add(obj);
		}
		update(objId: number, obj: any): P.Promise<any> {
			return super.update(objId, obj);
		}
		remove(objId: number): P.Promise<any> {
			return super.remove(objId);
		}
    }

    export class ReportTab extends ObjectRetriever {

        constructor(authToken: string, reportId: number) {
            super('Reports/' + reportId + '/Tabs', authToken);
        }

        findAll(): P.Promise<any> {
            return super.findAll();
        }
        find(objId: number): P.Promise<any> {
            return super.find(objId);
        }
        add(obj: any): P.Promise<any> {
            return super.add(obj);
        }
        update(objId: number, obj: any): P.Promise<any> {
            return super.update(objId, obj);
        }
        remove(objId: number): P.Promise<any> {
            return super.remove(objId);
        }
    }

    export class ReportDataBlock extends ObjectRetriever {

        constructor(authToken: string, reportId: number) {
            super('Reports/' + reportId + '/DataBlocks', authToken);
        }

        findAll(): P.Promise<any> {
            return super.findAll();
        }
        find(objId: number): P.Promise<any> {
            return super.find(objId);
        }
        add(obj: any): P.Promise<any> {
            return super.add(obj);
        }
        update(objId: number, obj: any): P.Promise<any> {
            return super.update(objId, obj);
        }
        remove(objId: number): P.Promise<any> {
            return super.remove(objId);
        }
    }

	export class Universe extends ObjectRetriever {

		constructor(authToken: string) {
			super('Universe', authToken);
		}

		findAll(): P.Promise<any> {
			return super.findAll();
		}
		find(objId: number): P.Promise<any> {
			return super.find(objId);
		}
		add(obj: any): P.Promise<any> {
			return super.add(obj);
		}
		update(objId: number, obj: any): P.Promise<any> {
			return super.update(objId, obj);
		}
		remove(objId: number): P.Promise<any> {
			return super.remove(objId);
		}
	}
	
	export class Log extends ObjectRetriever {

		constructor(authToken: string) {
			super('Log/Api', authToken);
		}

		log(logEntry: any): P.Promise<any> {
			return super.add(logEntry);
		}
	}
    
}