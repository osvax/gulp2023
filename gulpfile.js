let preprocessor = 'scss', 
		fileswatch   = 'html,htm,txt,json,md,woff2' // List of files extensions for watching & hard reload

import pkg from 'gulp'
const { gulp, src, dest, parallel, series, watch } = pkg

import browserSync   from 'browser-sync'
import rename   from 'gulp-rename'
import groupmedia    from 'gulp-group-css-media-queries'
import bssi          from 'browsersync-ssi'
import ssi           from 'ssi'
import webpackStream from 'webpack-stream'
import webpack       from 'webpack'
import TerserPlugin  from 'terser-webpack-plugin'
import gulpSass      from 'gulp-sass'
import dartSass      from 'sass'
import sassglob      from 'gulp-sass-glob'
const  sass          = gulpSass(dartSass)
import postCss       from 'gulp-postcss'
import cssnano       from 'cssnano'
import autoprefixer  from 'autoprefixer'
import imagemin      from 'gulp-imagemin'
import changed       from 'gulp-changed'
import concat        from 'gulp-concat'
import rsync         from 'gulp-rsync'
import {deleteAsync} from 'del'
import plumber       from 'gulp-plumber'
import notify        from 'gulp-notify'
import svgSprite     from 'gulp-svg-sprite'
import svgmin        from 'gulp-svgmin'
import webp          from 'gulp-webp'
import cheerio 		 from 'gulp-cheerio'
import replace 		 from 'gulp-replace'
import favicons 	 from 'gulp-favicons'
import debug 	     from 'gulp-debug'
import zip 	         from 'gulp-zip'
import path 	     from 'path'



// paths
const rootFolder = path.basename(path.resolve())
const srcFolder = './app'
const buildFolder = './dist'
const paths = {
  srcSvg: `${srcFolder}/images/svg/**.svg`,
  srcImgFolder: `${srcFolder}/images/src`,
  srcImgFavicons: `${srcFolder}/images/favicon`,
  buildImgFolder: `${buildFolder}/images`,
  buildSvgFolder: `${srcFolder}/images/svg`,
  buildWebpFolder: `${srcFolder}/images/webp`,
  buildImgFavicons: `${buildFolder}/images/favicon`,
  srcScss: `${srcFolder}/scss/app.scss`,
  buildCssFolder: `${srcFolder}/css`,
  srcJs: `${srcFolder}/js/app.js`,
  buildJsFolder: `${srcFolder}/js`,
  srcPartialsFolder: `${srcFolder}/part`,
  phpFolder: `${srcFolder}/phpmailer/**/*.php`,
  phpBuildFolder: `${buildFolder}/phpmailer`,
};

let isProd = false; // dev by default

function webpImages(){
	return src([`${paths.srcImgFolder}/**/**.{jpg,jpeg,png}`])
    .pipe(webp())
    .pipe(dest(paths.buildWebpFolder))
}

//svg sprite
function svgSprites(){
  return src(paths.srcSvg)
    .pipe(
      svgmin({
        js2svg: {
          pretty: true,
        },
      })
    )
    .pipe(
      cheerio({
        run: function ($) {
          $('[fill]').removeAttr('fill');
          $('[stroke]').removeAttr('stroke');
          $('[style]').removeAttr('style');
        },
        parserOptions: {
          xmlMode: true
        },
      })
    )
    .pipe(replace('&gt;', '>'))
    .pipe(svgSprite({
	  mode: {
      stack: {
        sprite: "../sprite/sprite.svg"
      },
		symbol: {
			sprite: "../sprite/sprite.svg",
			render: {
				scss: {
					dest:srcFolder + '/scss/_sprite.scss',
					template: srcFolder + '/scss/templates/_sprite_template.scss'
				}
			}
		}
	},
    }))
    .pipe(dest(paths.buildSvgFolder));
}

function browsersync() {
	browserSync.init({
		server: {
			baseDir: srcFolder+'/',
			middleware: bssi({ baseDir: srcFolder+'/', ext: '.html' })
		},
		ghostMode: { clicks: false },
		notify: false,
		online: true,
		// tunnel: 'yousutename', // Attempt to use the URL https://yousutename.loca.lt
	})
}

function scripts() {
	return src(paths.srcJs)
		.pipe(webpackStream({
			mode: 'production',
			performance: { hints: false },
			plugins: [
				new webpack.ProvidePlugin({ $: 'jquery', jQuery: 'jquery', 'window.jQuery': 'jquery' }), // jQuery (npm i jquery)
			],
			module: {
				rules: [
					{
						test: /\.m?js$/,
						exclude: /(node_modules)/,
						use: {
							loader: 'babel-loader',
							options: {
								presets: ['@babel/preset-env'],
								plugins: ['babel-plugin-root-import']
							}
						}
					}
				]
			},
			optimization: {
				minimize: true,
				minimizer: [
					new TerserPlugin({
						terserOptions: { format: { comments: false } },
						extractComments: false
					})
				]
			},
		}, webpack)).on('error', (err) => {
			this.emit('end')
		})
		.pipe(concat('app.min.js'))
		.pipe(dest(paths.buildJsFolder))
		.pipe(browserSync.stream())
}

function styles() {
	return src(paths.srcScss)
		.pipe(plumber(
		  notify.onError({
			title: "SCSS",
			message: "Error: <%= error.message %>"
		  })
		))
		.pipe(eval(sassglob)())
		.pipe(eval(sass)({ 'include css': true }))
		.pipe(postCss([
			autoprefixer({ grid: 'autoplace' }),
			cssnano({ preset: ['default', { discardComments: { removeAll: true } }] })
		]))
		.pipe(groupmedia())
		.pipe(concat('app.min.css'))
		.pipe(dest(paths.buildCssFolder))
		.pipe(browserSync.stream())
}

function favicon(){	
	return src([`${srcFolder}/**.png`])
        .pipe(favicons({
            icons: {
                appleIcon: true,
                favicons: true,
                online: false,
                appleStartup: false,
                android: false,
                firefox: false,
                yandex: false,
                windows: false,
                coast: false
            }
        }))
        .pipe(dest(paths.srcImgFavicons))
        .pipe(debug({
            "title": "Favicons"
        }));
}

function images() {
	return src(['app/images/src/**/*'])
		.pipe(changed('app/images/dist'))
		.pipe(imagemin())
		.pipe(dest('app/images/dist'))
		.pipe(browserSync.stream())
}

function buildcopy() {
	return src([
		'{app/js,app/css}/*.min.*',
		'app/images/**/*.*',
		'!app/images/src/**/*',
		'app/fonts/**/*',
		'app/phpmailer/**/*',
		'app/favicon.ico'
	], { base: 'app/' })
	.pipe(dest('dist'))
}

async function buildhtml() {
	let includes = new ssi('app/', 'dist/', '/**/*.html')
	includes.compile()
	await deleteAsync('dist/parts', { force: true })
}

async function cleandist() {
	await deleteAsync('dist/**/*', { force: true })
}

function deploy() {
	return src('dist/')
		.pipe(rsync({
			root: 'dist/',
			hostname: 'username@yousite.com',
			destination: 'yousite/public_html/',
			 clean: true, // Mirror copy with file deletion
			include: [ '*.htaccess' ], // Included files to deploy,
			exclude: [ '**/Thumbs.db', '**/*.DS_Store' ],
			recursive: true,
			archive: true,
			silent: false,
			compress: true
		}))
}




function copy(){
	return src(`${srcFolder}/ht.access`, {})
		.pipe(rename(`/.htaccess`))
		.pipe(dest(`${buildFolder}`))
}



function startwatch() {
	watch(`app/scss/app.scss`, { usePolling: true }, styles)
	watch('app/js/app.js', { usePolling: true }, scripts)
	watch('app/images/src/**/*', { usePolling: true }, images, favicon)
	watch(`${paths.srcImgFolder}/**/**.{jpg,jpeg,png}`, webpImages)
	watch(`app/**/*.{${fileswatch}}`, { usePolling: true }).on('change', browserSync.reload)
	watch(paths.srcSvg, svgSprites)
}

export { scripts, styles, images, favicon, webpImages, svgSprites, copy, deploy }
export let assets = series(scripts, styles, images, favicon, webpImages)
export let build = series(cleandist, svgSprites, images, favicon, webpImages, scripts, styles, buildcopy, buildhtml, copy)

export default series(cleandist, scripts, styles, images, favicon, webpImages, svgSprites, buildhtml,  parallel(browsersync, startwatch))


