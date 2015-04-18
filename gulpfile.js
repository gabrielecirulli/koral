var fs    = require("fs");
var path  = require("path");
var child = require("child_process");

var bower      = require("gulp-bower");
var del        = require("del");
var ghaml      = require("gulp-haml");
var glob       = require("gulp-css-globbing");
var gulp       = require("gulp");
var haml       = require("haml");
var header     = require("gulp-header");
var livereload = require("gulp-livereload");
var mapStream  = require("map-stream");
var minify     = require("gulp-minify-css");
var notify     = require("gulp-notify");
var plumber    = require("gulp-plumber");
var sass       = require("gulp-sass");

var CONFIG = {
  PATHS: {
    PUBLIC: "public",
    APP:    "app",
    SERVER: "node_modules/.bin/http-server",
  },
  LAYOUTS: {
    SRC:     "app/layouts",
    DEFAULT: "application",
  },
  VIEWS: {
    SRC:  "app/views",
    DEST: "public",
  },
  STYLESHEETS: {
    SRC:  "app/assets/stylesheets",
    DEST: "public/stylesheets",
  },
  JAVASCRIPTS: {
    SRC:  "app/assets/javascripts",
    DEST: "public/javascripts",
  },
  IMAGES: {
    SRC:  "app/assets/images",
    DEST: "public/images",
  },
  FONTS: {
    SRC:  "app/assets/fonts",
    DEST: "public/fonts",
  },
  BOWER: {
    DEST: "bower_components",
  },
};

// Helpers

var notice = function (location) {
  return header([
    "/* Don't edit this file. Make changes in",
    location,
    "instead. */\n",
  ].join(" "));
};

var errorHandler = function () {
  return plumber({
    errorHandler: notify.onError({
      sound:   "Glass",
      message: "Error: <%= error.message %>",
    }),
  });
};

// Tasks

gulp.task("bower", function () {
  bower()
    .pipe(gulp.dest(CONFIG.BOWER.DEST));
});

gulp.task("views", function () {
  var src    = path.join(CONFIG.LAYOUTS.SRC, CONFIG.LAYOUTS.DEFAULT + ".haml");
  var layout = haml(fs.readFileSync(src, "utf-8"));

  gulp.src(CONFIG.VIEWS.SRC + "/**/*.haml")
      .pipe(errorHandler())
      .pipe(ghaml())
      .pipe(mapStream(function (file, callback) {
        file.contents = new Buffer(layout({ content: file.contents }));
        callback(null, file);
      }))
      .pipe(gulp.dest(CONFIG.VIEWS.DEST))
      .pipe(livereload());
});

gulp.task("stylesheets", function () {
  gulp.src(CONFIG.STYLESHEETS.SRC + "/application.scss")
      .pipe(errorHandler())
      .pipe(glob({ extensions: [".css", ".scss"] }))
      .pipe(sass({
        includePaths: [
          CONFIG.STYLESHEETS.SRC,
          CONFIG.BOWER.DEST + "/bootstrap-sass-official/assets/stylesheets",
          CONFIG.BOWER.DEST + "/bourbon/app/assets/stylesheets",
        ],
      }))
      .pipe(minify({ keepSpecialComments: 0 }))
      .pipe(notice(CONFIG.STYLESHEETS.SRC))
      .pipe(gulp.dest(CONFIG.STYLESHEETS.DEST))
      .pipe(livereload());
});

gulp.task("javascripts", function () {
  gulp.src(CONFIG.JAVASCRIPTS.SRC  + "/index.js")
      .pipe(errorHandler())
      .pipe(notice(CONFIG.JAVASCRIPTS.SRC))
      .pipe(gulp.dest(CONFIG.JAVASCRIPTS.DEST))
      .pipe(livereload());
});

gulp.task("images", function () {
  gulp.src(CONFIG.IMAGES.SRC + "/**/*")
      .pipe(gulp.dest(CONFIG.IMAGES.DEST));
});

gulp.task("fonts", function () {
  gulp.src(CONFIG.FONTS.SRC + "/**/*")
      .pipe(gulp.dest(CONFIG.FONTS.DEST));
});

gulp.task("default", [
  "bower", "views", "stylesheets", "javascripts", "images", "fonts"
]);

gulp.task("watch", ["default"], function () {
  livereload.listen();

  gulp.watch(CONFIG.VIEWS.SRC + "/**/*.haml",       ["views"]);
  gulp.watch(CONFIG.LAYOUTS.SRC + "/**/*.haml",     ["views"]);
  gulp.watch(CONFIG.STYLESHEETS.SRC + "/**/*.scss", ["stylesheets"]);
  gulp.watch(CONFIG.JAVASCRIPTS.SRC + "/**/*.js",   ["javascripts"]);
  gulp.watch(CONFIG.IMAGES.SRC + "/**/*",           ["images"]);
  gulp.watch(CONFIG.FONTS.SRC + "/**/*",           ["fonts"]);
});

gulp.task("dev", ["watch"], function () {
  var proc = child.spawn(CONFIG.PATHS.SERVER, [CONFIG.PATHS.PUBLIC, "-p4000"]);

  /* eslint-disable no-console */
  proc.stdout.on("data", function (data) { console.log(data.toString()); });
  /* eslint-enable */
});

gulp.task("deploy", function () {
  /* eslint-disable no-console */
  var branch = child.execSync("git symbolic-ref --short -q HEAD 2>/dev/null")
                    .toString()
                    .trim();

  if (branch !== "master") throw new Error("Can only deploy from master");

  console.log("Switching to gh-pages...");
  child.execSync("git checkout gh-pages");

  console.log("Merging master into gh-pages...");
  child.execSync("git merge master --no-commit --no-ff");

  console.log("Moving the contents of the public directory to the root");
  child.execSync("mv -v " + CONFIG.PATHS.PUBLIC + "/* .");

  console.log("Removing redundant files...");
  del.sync([
    CONFIG.PATHS.PUBLIC,
    CONFIG.PATHS.APP,
    ".eslintrc",
    "gulpfile.js",
    "bower.json",
    "package.json",
  ]);

  console.log("Committing...");
  child.execSync("git add .");
  child.execSync("git commit -am 'Update gh-pages'");

  console.log("Pushing...");
  child.execSync("git push origin gh-pages");

  console.log("Switching back to " + branch + "...");
  child.execSync("git checkout master");
  /* eslint-enable */
});

gulp.task("clean", function () {
  del([CONFIG.PATHS.PUBLIC], function (err, deletedFiles) {
    /* eslint-disable no-console */
    console.log("Deleted:", deletedFiles.join(", "));
    /* eslint-enable */
  });
});
