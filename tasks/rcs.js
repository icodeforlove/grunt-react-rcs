var fs = require('fs'),
	RCS = require('react-rcs'),
	glob = require('glob'),
	path = require('path'),
	colors = require('colors'),
	Promise = require('whenplus'),
	PromiseObject = require('promise-object')(Promise),
	Cubby = require('cubby'),
	cache = new Cubby({file: '.rcscache'}),
	path = require('path');

var RCSTask = PromiseObject.create({
	initialize: function (files, dest, callback) {
		fs.lstat(dest, function (error, stat) {
			this.outputFile = dest.replace(/.rcs$/, '.css');
			fs.writeFileSync(dest, '');
			
			this.files = files;

			this.compileFiles().done(function () {
				callback();
			});
		}.bind(this));
	},

	$compileFilePairs: function ($deferred, $class, filePairs) {
		// make all dirs needed
		var dirs = $class.getAllDirsFromFilePairs(filePairs);
		dirs.forEach(function (dir) {
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir);
			}
		});

		// compile all file pairs
		Promise.map(filePairs, $class.compileFilePair).done($deferred.resolve, $deferred.reject);
	},


	$compileFilePair: function ($deferred, filePair) {
		var instance = new RCSTask(filePair.src, filePair.dest, function () {
			$deferred.resolve();
		});
	},

	compileFiles: function ($deferred, $self) {
		Promise.map(this.files, $self.readFileAndWriteToCSS).done(function () {
			$deferred.resolve();
		});
	},

	readFileAndWriteToCSS: function ($deferred, $self, file) {
		var cachedInfo = cache.get(file, true);

		if (cachedInfo) {
			var lastChanged = fs.statSync(file).mtime.getTime(),
				changed = lastChanged != cachedInfo.timestamp;

			if (!changed) {
				fs.appendFileSync($self.outputFile, cachedInfo.source);
				return $deferred.resolve();
			}
		}

		fs.readFile(file, 'utf8', function (error, source) {
			if (source.match(/\@component/)) {
				$self.processMultipleComponents(file, source).done(
					function () {
						$deferred.resolve();
					},
					function () {
						$deferred.reject();
					}
				);
			} else {
				$self.processSingleComponent(file, source).done(
					function () {
						$deferred.resolve();
					},
					function () {
						$deferred.reject();
					}
				);
			}
		});
	},

	processSingleComponent: function ($deferred, $self, file, source) {
		var componentName = path.basename(file, '.rcs'),
			style = new RCS.Style(componentName, source, {});

		var cssSource = '/* Style for component ' + componentName + ' */\n';
		cssSource += style.toString();
		cssSource += '\n';
		cssSource = cssSource.trim();

		cache.set(file, {timestamp: fs.statSync(file).mtime.getTime(), source: cssSource});
		fs.appendFile($self.outputFile, cssSource, function (err) {
			console.log(('built Style("' + componentName + '")').cyan);
			$deferred.resolve();
		});
	},

	processMultipleComponents: function ($deferred, $self, file, source) {
		var cssSource = '',
			components;

		try {
			components = new RCS.Parser.parseRCS(source);
		} catch (exception) {
			throw new Error('Parsing file ' + file + '\n' + exception);
		}
		var styles = [];

		for (var component in components) {
			
			var componentName = component.match(/@component (.+)/)[1];
			var style = new RCS.Style(componentName, components[component], {});

			styles.push(componentName);

			console.log(('built Style("' + componentName + '")').cyan);
			cssSource += '/* Style for component ' + componentName + ' */\n';
			cssSource += style.toString() + '\n';
		}

		cssSource = cssSource.trim();

		cache.set(file, {
			timestamp: fs.statSync(file).mtime.getTime(),
			source: cssSource
		});

		fs.appendFile($self.outputFile, cssSource, function (err) {
			$deferred.resolve();
		});
	},

	$getAllDirsFromFilePairs: function ($class, filePairs) {
		var dirs = [],
			files = $class.getAllFilesFromFilePairs(filePairs);
		
		files.forEach(function (filePath) {
			var isDir = filePath.match(/\/$/);

			filePath.split('/').forEach(function (part, index, array) {
				if (part && (index !== array.length-1 || isDir && index === array.length-1)) {
					var dir = array.slice(0, index + 1).join('/') + '/';
					if (dirs.indexOf(dir) === -1) {
						dirs.push(array.slice(0, index + 1).join('/') + '/');
					}
				}
			});
		});
		
		return dirs;
	},

	$getAllFilesFromFilePairs: function (filePairs) {
		return Array.prototype.concat.apply([], filePairs.map(function (file) {
			return file.dest;
		}));
	}
});


module.exports = function(grunt) {
	var config = grunt.config.get('rcs').options;

	if (config && config.settings) {
		var propertiesInit = require(process.cwd() + '/' + config.settings);
		if (typeof propertiesInit == 'function') propertiesInit(RCS.Properties);
	}

	grunt.registerMultiTask('rcs', 'Compile rcs files to css.', function(target) {
		var callback = this.async();

		RCSTask.compileFilePairs(this.files).done(function () {
			callback();
		});
	});
};