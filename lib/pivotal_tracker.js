// Pivotal Tracker API v3
var https = require('https'),
    querystring = require('querystring'),
    xml2js = require('xml2js'),
    builder = require('xmlbuilder');

function PivotalTracker(options) {
  if (!options) options = {};
  this.host = options.host || 'www.pivotaltracker.com';
  this.relativeAPIPath = '/services/v3';
  this.token = null;
}

PivotalTracker.prototype.authenticate = function(username, password, callback) {
  var auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');
  var headers = {
    Authorization: auth
  };
  this._parsedResponse('GET', '/tokens/active', null, headers, null, function(error, response) {
    if (response !== null && response.hasOwnProperty('guid')) {
      response = response.guid;
    }
    callback(error, response);
  });
};

PivotalTracker.prototype.allProjects = function(token, callback) {
  this._parsedResponse('GET', '/projects', token, null, null, callback);
};

PivotalTracker.prototype.allMemberships = function(projectID, token, callback) {
  this._parsedResponse('GET', '/projects/' + projectID + '/memberships', token, null, null, callback);
};

PivotalTracker.prototype.addProject = function(projectName, token, callback) {
  var root = builder.begin('project');
  var ele = root.ele('name');
  ele.txt(projectName);
  var body = root.toString();
  this._parsedResponse('POST', '/projects', token, null, body, callback);
};

PivotalTracker.prototype.allIterations = function(projectID, token, callback) {
  var relativePath = '/projects/' + projectID + '/iterations';
  var self = this;
  this._fetchStories(relativePath, token, callback);
};

PivotalTracker.prototype.storiesByIteration = function(projectID, iteration, filter, offset, limit, token, callback) {
  var query = querystring.stringify({filter: filter, offset: offset, limit: limit});
  var relativePath = '/projects/' + projectID + '/iterations/' + iteration + '?' + query;
  this._fetchStories(relativePath, token, callback);
};

PivotalTracker.prototype.storiesByFilter = function(projectID, filter, offset, limit, token, callback) {
  var query = querystring.stringify({filter: filter, offset: offset, limit: limit});
  var relativePath = '/projects/' + projectID + '/stories?' + query;
  var self = this;
  this._parsedResponse('GET', relativePath, token, null, null, function(error, response) {
    if (error) {
      callback(error, null);
      return;
    }
    self._expandKeyPath(response, 'story', function(success, value) {
      callback(error, value);
    });
  });
};

PivotalTracker.prototype.addStory = function(projectID, values, token, callback) {
  var relativePath = '/projects/' + projectID + '/stories';
  var body = this._serialisedStory(values);
  this._parsedResponse('POST', relativePath, token, null, body, callback);
};

PivotalTracker.prototype._serialisedStory = function(values) {
  var root = builder.begin('story');
  for (var key in values) {
    var value = values[key];
    var ele = root.ele(key);
    ele.txt(value);

    // Estimates require an additional type attribute
    if (key === 'estimate') {
      ele.att('type', 'integer');
    }
  }
  return root.toString();
};

PivotalTracker.prototype.deleteStory = function(projectID, storyID, token, callback) {
  var relativePath = '/projects/' + projectID + '/stories/' + storyID;
  this._parsedResponse('DELETE', relativePath, token, null, null, callback);
};

PivotalTracker.prototype.updateStory = function(projectID, storyID, values, token, callback) {
  var relativePath = '/projects/' + projectID + '/stories/' + storyID;
  var body = this._serialisedStory(values);
  this._parsedResponse('PUT', relativePath, token, null, body, callback);
};

PivotalTracker.prototype._fetchStories = function(relativePath, token, callback) {
  var self = this;
  this._parsedResponse('GET', relativePath, token, null, null, function(error, response) {
    if (error) {
      callback(error, null);
      return;
    }
    self._expandKeyPath(response, 'iteration', function(success, value) {
      callback(error, value);
    });
  });
};

PivotalTracker.prototype._parsedResponse = function(method, relativePath, token, opt_headers, opt_body, callback) {
  var result = null;
  var headerValues = opt_headers || null;
  var contentLength = opt_body !== null ? opt_body.length : 0;
  if (!headerValues) {
    headerValues = {
      'X-TrackerToken': token,
      'Content-type': 'application/xml',
      'Content-length': contentLength
    };
  }

  var options = {
    host: this.host,
    path: this.relativeAPIPath + relativePath,
    headers: headerValues,
    method: method
  };
  var request = https.request(options, function(response) {
    var parser = new xml2js.Parser();
    var error = null;
    if (response.statusCode !== 200 && response.statusCode === 401) {
      error = 'Incorrect username/password combination.';
    } else if (response.statusCode !== 200) {
      error = 'Error with HTTP status code: '+response.statusCode;
    }
    if (error) {
      callback(error, null);
    }

    parser.addListener('end', function(result) {
      callback(error, result);
    });

    response.setEncoding('utf8');
    response.on('data', function (chunk) {
      parser.parseString(chunk);
    });
  }).on('error', function(error) {
      callback(error, result);
  });

  if (opt_body) {
    request.write(opt_body);
  }
  request.end();
};

PivotalTracker.prototype._expandKeyPath = function(object, keyPath, callback) {
  var properties = keyPath.split('.');
  for (var i=0; i<properties.length; i++) {
    var property = properties[i];
    if (object && object.hasOwnProperty(property)) {
      object = object[property];
    } else {
      callback(false, null);
      break;
    }
  }

  // Ensure array is always returned
  if (object && !object.length) object = [object];
  callback(true, object);
};

module.exports = PivotalTracker;
