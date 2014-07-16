var fs = require('fs'),
	RCS = require('react-rcs'),
	glob = require('glob'),
	path = require('path'),
	colors = require('colors'),
	Promise = require('whenplus'),
	PromiseObject = require('promise-object')(Promise),
	Cubby = require('cubby'),
	cache = new Cubby({file: '.rcscache'});

var RCSTask = PromiseObject.create({
	initialize: function (files, dest, callback) {
		fs.lstat(dest, function (error, stat) {
			if (!error && stat.isDirectory()) {
				this.outputDir = dest;
			} else if (error || stat.isFile()) {
				this.outputFile = dest;

				fs.writeFileSync(dest, '');
			}
			
			this.files = files;

			this.compileFiles().done(function () {
				callback();
			});
		}.bind(this));
	},

	$compile: function ($deferred, options) {
		var instance = new RCSTask(options.src, options.dest, function () {
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

			if (this.outputFile && !changed) {
				fs.appendFileSync($self.outputFile, cachedInfo.source);
				return $deferred.resolve();
			} else if (this.outputDir) {
				fs.writeFile(file.replace(/.rcs$/, '.css'), cachedInfo.source, function () {
					$deferred.resolve();
				});

				return;
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
			style = new RCS.Style(componentName, source, {}),
			cssSource = style.toString();

		if ($self.outputDir) {

			fs.writeFile(file.replace(/.rcs$/, '.css'), cssSource, function () {
				console.log(('built Style("' + componentName + '")').cyan);
				$deferred.resolve();
			});
			cache.set(file, {timestamp: fs.statSync(file).mtime.getTime(), source: cssSource});
		} else if ($self.outputFile) {
			cssSource = '/* Style for component ' + componentName + ' */\n' + cssSource;
			cssSource += '\n';
			cssSource = cssSource.trim();

			cache.set(file, {timestamp: fs.statSync(file).mtime.getTime(), source: cssSource});
			fs.appendFile($self.outputFile, cssSource, function (err) {
				console.log(('built Style("' + componentName + '")').cyan);
				$deferred.resolve();
			});
		}
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

		if ($self.outputDir) {
			fs.writeFile($self.outputDir + '/' + path.basename(file, '.rcs') + '.css', cssSource, function () {
				styles.forEach(function (componentName) {
					$deferred.resolve();
				});
			});
		} else if ($self.outputFile) {
			fs.appendFile($self.outputFile, cssSource, function (err) {
				$deferred.resolve();
			});
		}
	}


});

module.exports = function(grunt) {
	var config = grunt.config.get('rcs').config;

	if (config && config.settings) {
		// cant figure out how to properly resolve the path
		var propertiesInit = eval('(function () {' + fs.readFileSync(config.settings, 'utf8') + '; return RCSPropertiesInit;})()');
		if (typeof propertiesInit == 'function') propertiesInit(RCS.Properties);
	}

	grunt.registerMultiTask('rcs', 'Compile rcs files to css.', function(target) {
		var callback = this.async(),
			files = [];

		Promise.map(this.files, RCSTask.compile).done(function () {
			callback();
		});
	});
};