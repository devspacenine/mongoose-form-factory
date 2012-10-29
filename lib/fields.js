var async = require('async'),
mongoose = require('mongoose'),
EventEmitter = require('events').EventEmitter,
factory = require('./factory'),
widgets = require('./widgets'),
validators = require('./validators'),
util = require('util'),
_ = require('underscore'),
Schema = mongoose.Schema,
ObjectId = Schema.Types.ObjectId,
Image = Schema.Types.Image,
Email = Schema.Types.Email,
Url = Schema.Types.Url;

function Field(opts) {
    Field.super_.call(this);
    this.className = "Field";

    // Copy the options set in the schema, add an _ to avoid clashes with
    // template methods
    this.optsCopy = {};
    for(var k in opts) {
        if(opts.hasOwnProperty(k)) {
            this['_'+k] = opts[k];
            this.optsCopy['_'+k] = opts[k];
        }
    }

    // Set the widget if is isn't already set
    this.widget = this.widget || widgets.text(_.extend({classes: this.classes()}, this.optsCopy));
}
util.inherits(Field, EventEmitter);

Field.prototype._clone = function() {
    var property, clone = {};
    // clone field object:
    for (property in this) {
        if (this.hasOwnProperty(property)) {
            clone[property] = this[property];
        }
    }
    return clone;
}

Field.prototype.parse = function(raw_data) {
    if(typeof raw_data !== 'undefined' && raw_data !== null) {
        return String(raw_data);
    }
    return '';
}

// Bind data to the field and validate it
Field.prototype.bind = function(raw_data) {
    this._value = raw_data;
    this._data = this.parse(raw_data);
    b.validate = function (form, callback) {
        if (raw_data === '' || raw_data === null || typeof raw_data === 'undefined') {
            // don't validate empty fields, but check if required
            if (b._required) { b._error = 'This field is required.'; }
            process.nextTick(function () { callback(null, b); });
        } else {
            async.forEachSeries(b._validators || [], function (v, callback) {
                if (!b._error) {
                    v(form, b, function (v_err) {
                        b._error = v_err ? v_err.toString() : null;
                        callback(null);
                    });
                } else {
                    callback(null);
                }
            }, function (err) {
                callback(err, b);
            });
        }
    };
    return b;
}

Field.prototype._validate = function(form, callback) {
    var self = this;
    if (this._value === '' || this._value === null || typeof this._value === 'undefined') {
        // don't validate empty fields, but check if required
        if (this._required) {
            this._error = 'This field is required.';
        }
        process.nextTick(function () { callback(null, this); });
    } else {
        async.forEachSeries(this._validators || [], function (obj, callback) {
            if (!self._error && !obj.validator(self._value)) {
                self._error = obj.msg || 'Error: undefined';
                callback(null);
            } else {
                callback(null);
            }
        }, function (err) {
            callback(err, this);
        });
    }
}

Field.prototype.help_text = function() {
    return this.widget.type === 'hidden' ? '' :
        this._help_text ? '<{wrapper} class="help_text" for="id_{name}">{help_text}</{wrapper}>'.assign({
        wrapper: 'p',
        name: this._name,
        help_text: this._help_text
    }) : '';
}

Field.prototype.error = function() {
    return this.widget.type === 'hidden' ? '' :
        this._error ? '<label for="id_{name}" class="error">{error}</label>'.assign({
        name: this._name,
        error: this._error
    }) : '';
}

Field.prototype.label = function() {
    return this.widget.type === 'hidden' ? '' :
        '<label for="id_{name}">{label}</label>'.assign({
        name: this._name,
        label: this._label || this._name.humanize()
    });
}

Field.prototype.input = function() {
    return this.toString();
}

Field.prototype.classes = function() {
    var r = ['field'];
    if (this._error) { r.push('error'); }
    if (this._required) { r.push('required'); }
    return r;
}

Field.prototype.full = function() {
    return '{help_text} {error} {label} {input}'.assign({
        help_text: this.help_text(),
        error: this.error(),
        label: this.label(),
        input: this.toString()
    });
}

Field.prototype.as_p = function() {
    var self = this;
    return '<p class="field_wrapper" id="wrap_{name}">{field}</p>'.assign({
        name: this._name,
        field: arguments.length === 0 ? this.full() : _.reduce([].slice.call(arguments, 0), function(memo, arg) {
            return '{memo} {arg}'.assign({
                memo: memo,
                arg: (typeof this[arg] === 'function') ? this[arg]() : '',
            });
        }, '', self)
    });
}

Field.prototype.as_div = function() {
    var self = this;
    return '<div class="field_wrapper" id="wrap_{name}">{field}</div>'.assign({
        name: this._name,
        field: arguments.length === 0 ? this.full() : _.reduce([].slice.call(arguments, 0), function(memo, arg) {
            return '{memo} {arg}'.assign({
                memo: memo,
                arg: (typeof this[arg] === 'function') ? this[arg]() : '',
            });
        }, '', self)
    });
}

Field.prototype.toHTML = function(name, iterator) {
    return (iterator || render.div)(name, this);
}

Field.prototype.toString = function() {
    return this.widget.render(this);
}

Field.prototype.valueOf = function() {
    return this.widget.render(this);
}

/********************************************************************
* String Field
* ******************************************************************/
function StringField(opts) {
    StringField.super_.call(this, opts);
    this.className = "StringField";
}
util.inherits(StringField, Field);

/********************************************************************
* Password Field
* ******************************************************************/
function PasswordField(opts) {
    PasswordField.super_.call(this, opts);
    this.className = "PasswordField";

    // Set the widget if is isn't already set
    this.widget = widgets.password(_.extend({classes: this.classes()}, this.optsCopy));
}
util.inherits(PasswordField, Field);

/********************************************************************
* Captcha Field
* ******************************************************************/
function CaptchaField(opts) {
    CaptchaField.super_.call(this, opts);
    this.className = "CaptchaField";

    // Set the widget if is isn't already set
    this.widget = widgets.password(_.extend({classes: this.classes()}, this.optsCopy));
}
util.inherits(CaptchaField, Field);

/********************************************************************
* Email Field
* ******************************************************************/
function EmailField(opts) {
    EmailField.super_.call(this, opts);
    this.className = "EmailField";

    // Set the widget if is isn't already set
    this.widget = widgets.email(_.extend({classes: this.classes()}, this.optsCopy));
}
util.inherits(EmailField, Field);

/********************************************************************
* Url Field
* ******************************************************************/
function UrlField(opts) {
    UrlField.super_.call(this, opts);
    this.className = "UrlField";

    // Set the widget if is isn't already set
    this.widget = widgets.url(_.extend({classes: this.classes()}, this.optsCopy));
}
util.inherits(UrlField, Field);

/********************************************************************
* Number Field
* ******************************************************************/
function NumberField(opts) {
    NumberField.super_.call(this, opts);
    this.className = "NumberField";

    // Set the widget if is isn't already set
    this.widget = widgets.number(_.extend({classes: this.classes()}, this.optsCopy));
}
util.inherits(NumberField, Field);

NumberField.prototype.parse = function(raw_data) {
    if(typeof raw_data !== 'undefined' && raw_data !== null) {
        return Number(raw_data);
    }
    return 0;
}

/********************************************************************
* Boolean Field
* ******************************************************************/
function BooleanField(opts) {
    BooleanField.super_.call(this, opts);
    this.className = "BooleanField";

    // Set the widget if is isn't already set
    this.widget = widgets.checkbox(_.extend({classes: this.classes()}, this.optsCopy));
}
util.inherits(BooleanField, Field);

BooleanField.prototype.parse = function(raw_data) {
    if(typeof raw_data !== 'undefined' && raw_data !== null) {
        return Boolean(raw_data);
    }
    return false;
}

/********************************************************************
* Date Field
* ******************************************************************/
function DateField(opts) {
    DateField.super_.call(this, opts);
    this.className = "DateField";

    // Set the widget if is isn't already set
    this.widget = widgets.date(_.extend({classes: this.classes()}, this.optsCopy));
}
util.inherits(DateField, Field);

DateField.prototype.parse = function(raw_data) {
    if(typeof raw_data !== 'undefined' && raw_data !== null) {
        return Date(raw_data);
    }
    return null;
}

/********************************************************************
* File Field
* ******************************************************************/
function FileField(opts) {
    FileField.super_.call(this, opts);
    this.className = "FileField";

    // Set the widget if is isn't already set
    this.widget = widgets.file(_.extend({classes: this.classes()}, this.optsCopy));
}
util.inherits(FileField, Field);

FileField.prototype.parse = function(raw_data) {
    if(typeof raw_data !== 'undefined' && raw_data !== null) {
        console.log(raw_data);
        //return Date(raw_data);
    }
    return null;
}

/********************************************************************
* Image Field
* ******************************************************************/
function ImageField(opts) {
    ImageField.super_.call(this, opts);
    this.className = "ImageField";

    // Set the widget if is isn't already set
    this.widget = widgets.file(_.extend({classes: this.classes()}, this.optsCopy));
}
util.inherits(ImageField, FileField);

ImageField.prototype.parse = function(raw_data) {
    if(typeof raw_data !== 'undefined' && raw_data !== null) {
        console.log(raw_data);
        //return Date(raw_data);
    }
    return null;
}

/********************************************************************
* ObjectId Field
* ******************************************************************/
function ObjectIdField(opts) {
    ObjectIdField.super_.call(this, opts);
    this.className = "ObjectIdField";
}
util.inherits(ObjectIdField, Field);

ObjectIdField.prototype.parse = function(raw_data) {
    if(typeof raw_data !== 'undefined' && raw_data !== null) {
        return String(raw_data);
    }
    return null;
}

/********************************************************************
* Hidden Field
* ******************************************************************/
function HiddenField(opts) {
    HiddenField.super_.call(this, opts);
    this.className = "HiddenField";

    // Set the widget if is isn't already set
    this.widget = this.widget || widgets.hidden(_.extend({classes: this.classes()}, this.optsCopy));
}
util.inherits(HiddenField, Field);

module.exports = {
    string: function(opts) {
        return new StringField(opts);
    },

    password: function(opts) {
        return new PasswordField(opts);
    },

    number: function(opts) {
        return new NumberField(opts);
    },

    boolean: function(opts) {
        return new BooleanField(opts);
    },

    date: function(opts) {
        return new DateField(opts);
    },

    schemadate: function(opts) {
        return new DateField(opts);
    },

    email: function(opts) {
        return new EmailField(opts);
    },

    captcha: function(opts) {
        return new CaptchaField(opts);
    },

    url: function(opts) {
        return new UrlField(opts);
    },

    file: function(opts) {
        return new FileField(opts);
    },

    image: function(opts) {
        return new ImageField(opts);
    }, 

    array: function(opts) {
        return new StringField(opts);
    },

    objectid: function(opts) {
        return new ObjectIdField(opts);
    }
};
