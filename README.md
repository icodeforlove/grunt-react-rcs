# grunt-react-rcs

A grunt task that compiles your RCS to css.

```
	npm install grunt-react-rcs --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```
	grunt.loadNpmTasks('grunt-react-rcs');
```

## uses?

The basic usage is generating CSS files next to your RCS files, this is mainly good to build with a tmp output structure.

```javascript
rcs: {
	build: {
		files: [
			{expand: true, cwd: 'scripts/', src: ['**/*.rcs'], dest: 'build/'}
		]
	}
}
```

You can also set your RCS `rcs.settings.js` file like this

```javascript
rcs: {
	config: {
		settings: 'scripts/rcs.settings.js'
	},

	build: {
		files: [
			{expand: true, cwd: 'scripts/', src: ['**/*.rcs'], dest: 'build/'}
		]
	}
}
```