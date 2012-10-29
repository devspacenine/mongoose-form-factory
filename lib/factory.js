var async = require('async'),
sugar = require('sugar'),
_ = require('underscore'),
http = require('http'),
querystring = require('querystring'),
EventEmitter = require('events').EventEmitter,
util = require('util'),
parse = require('url').parse,
mongoose = require('mongoose'),
mongooseTypes = require('mongoose-form-factory-types');
mongooseTypes.loadTypes(mongoose);
var Schema = mongoose.Schema,
ObjectId = Schema.Types.ObjectId,
Email = Schema.Types.Email,
Url = Schema.Types.Url,
Image = Schema.Types.Image,
File = Schema.Types.File,
widgets = require('./widgets'),
fields = require('./fields'),
validators = require('./validators');

function ModelForm(schema, opts) {
    ModelForm.super_.call(this);
    this.className = "Field";
    this._fields = {};
    this.errors = {};
    this.schema = schema;
    this.opts = opts;
    this._fieldChecks = {
        'String': String,
        'Number': Number,
        'Boolean': Boolean,
        'Date': Date,
        'SchemaDate': Date,
        'File': File,
        'Image': Image,
        'Email': Email,
        'Url': Url,
        'ObjectId': ObjectId,
        'captcha': 'captcha',
        'password': 'password'
    };
}
util.inherits(ModelForm, EventEmitter);

ModelForm.prototype._bind = function(data) {
    var b = {errors: {}, _fields: {}};
    Object.keys(this._fields).forEach(function (k) {
        b._fields[k] = this._fields[k].bind(data[k]);
    });
    b._data = Object.keys(b._fields).reduce(function (a, k) {
        a[k] = b._fields[k]._data;
        return a;
    }, {});
    b.validate = function(callback) {
        async.forEach(Object.keys(b._fields), function (k, callback) {
            b._fields[k].validate(b, function (err, bound_field) {
                b._fields[k] = bound_field;
                callback(err);
            });
        }, function(err) {
            callback(err, b);
        });
    };
    b.isValid = function() {
        var f = this;
        return Object.keys(f._fields).every(function (k) {
            return f._fields[k].error === null || typeof f._fields[k].error === 'undefined';
        });
    };
    return b;
}

ModelForm.prototype._handle = function(obj, callbacks) {
    if (typeof obj === 'undefined' || obj === null || (typeof obj === 'object' && Object.keys(obj).length === 0)) {
        (callbacks.empty || callbacks.other)(this);
    } else if (obj instanceof http.IncomingMessage) {
        if (obj.method === 'GET') {
            this._handle(parse(obj.url, 1).query, callbacks);
        } else if (obj.method === 'POST' || obj.method === 'PUT') {
            // If the app is using bodyDecoder for connect or express,
            // it has already put all the POST data into request.body.
            if (obj.body) {
                this._handle(obj.body, callbacks);
            } else {
                var buffer = '';
                obj.addListener('data', function (chunk) {
                    buffer += chunk;
                });
                obj.addListener('end', function () {
                    this._handle(querystring.parse(buffer), callbacks);
                });
            }
        } else {
            throw new Error('Cannot handle request method: ' + obj.method);
        }
    } else if (typeof obj === 'object') {
        this._bind(obj).validate(function (err, form) {
            if (form.isValid()) {
                (callbacks.success || callbacks.other)(form);
            } else {
                (callbacks.error || callbacks.other)(form);
            }
        });
    } else {
        throw new Error('Cannot handle type: ' + typeof obj);
    }
}

ModelForm.prototype._toHTML = function(iterator) {
    var self = this;
    return Object.keys(this._fields).reduce(function (html, k) {
        return html + self._fields[k].toHTML(k, iterator);
    }, '');
}

ModelForm.prototype._scanSchema = function() {
    var groups = {},
    self = this;
    this.schema.eachPath(function(path, schemaType) {
        var cont = true, fieldOpts;
        // Group nested types together and build form after iteration
        if(path.has(/^.+\..+$/)) {
            var namespace = path.split('.')[0];
            if(!Object.has(groups, namespace)) {
                groups[namespace] = [];
            }
            groups[namespace].push(path.split('.').slice(1).join('.'));
            return;
        }
        // Can't determine widget without options object and type
        if(!(schemaType.options || schemaType.options.type)) {
            console.log('Could not determine widget for field: Path({1}) SchemaType({2})'.assign(path, schemaType));
            return null;
        }
        if(cont && Array.isArray(schemaType.options.type)) {
            var cast = (Array == schemaType.options.type || 'array' == schemaType.options.type) ? schemaType.cast : schemaType.options.type[0];
            //console.log(typeof cast);
            fieldOpts = _.extend({
                validators: schemaType.validators,
                setters: schemaType.setters,
                getters: schemaType.getters,
                name: schemaType.path,
                type: schemaType.casterConstructor.name,
                editable: true
            }, (typeof cast === 'object') ? cast : {});
            //console.log(fieldOpts);
            Object.keys(self._fieldChecks).forEach(function(k) {
                if(cont && fieldOpts.type == self._fieldChecks[k].name && fieldOpts.editable) {
                    self[path] = self._fields[path] = fields[k.toLowerCase()](fieldOpts);
                    cont = false;
                    //console.log('{name} - {type}'.assign({name: fieldOpts.name, type: fieldOpts.type}));
                }
            });
        }else{
            fieldOpts = _.extend({
                validators: schemaType.validators,
                setters: schemaType.setters,
                getters: schemaType.getters,
                name: schemaType.path,
                type: schemaType.options.type.name,
                editable: true
            }, _.omit(schemaType.options, 'validate', 'get', 'set', 'type'));
            console.log(schemaType);
            Object.keys(self._fieldChecks).forEach(function(k) {
                if(cont && fieldOpts.type == self._fieldChecks[k].name && fieldOpts.editable ) {
                    self[path] = self._fields[path] = fields[k.toLowerCase()](fieldOpts);
                    cont = false;
                    //console.log('{name} - {type}'.assign({name: fieldOpts.name, type: fieldOpts.type}));
                }
            });
        }
    });           
    // Iterate through the custom fields and assign each a widget
    _.each(this.opts.fields || {}, function(options, name) {
        // Can't build widget without type
        if(!(_.has(options, 'type'))) {
            console.log('Could not determine widget for custom field: {1}'.assign(name));
            return null;
        }
        var fieldOpts = _.extend({
            validators: [],
            setters: [],
            getters: [],
            name: name,
            editable: true
        }, options),
        cont = true;
        //console.log(fieldOpts);
        Object.keys(self._fieldChecks).forEach(function(k) {
            if(cont && fieldOpts.editable && (fieldOpts.type.name == self._fieldChecks[k].name || fieldOpts.type == self._fieldChecks[k])) {
                self[name] = self._fields[name] = fields[k.toLowerCase()](fieldOpts);
                cont = false;
                //console.log('{name} - {type}'.assign({name: fieldOpts.name, type: fieldOpts.type}));
            }
        });
    });
}

module.exports = {
    FormFactory: function(schema, opts) {
        opts = opts || {};
        var modelForm = new ModelForm(schema, opts);
        // Iterate through every path in the Scheme to build the form
        modelForm._scanSchema();
        /* Static Methods */
        schema.static({
            ModelForm: function(set, data) {
                set = set || 'default';
                data = data || {};

                return modelForm;
            }
        });
    }
};
