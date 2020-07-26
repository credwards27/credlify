/* webpack.config.js
    
    Webpack configuration.
*/

const MinifyPlugin = require("babel-minify-webpack-plugin"),
    path = require("path"),
    getArg = require("./args"),
    CONFIG = require("./config"),
    
    wp = {
        module: {
            rules: [
                {
                    test: /\.js$/,
                    use: {
                        loader: "babel-loader",
                        options: {
                            configFile: path.resolve(
                                __dirname,
                                "babel.config.js"
                            )
                        }
                    }
                }
            ]
        },
        
        plugins: [],
        
        entry: {
            main: `./${CONFIG.PATH.SRC.JS}/index.js`
        },
        
        output: {
            filename: "[name].bundle.js",
            chunkFilename: "[name].bundle.js"
        },
        
        externals: {
            jquery: "jQuery"
        },
        
        mode: "development",
        devtool: "source-map"
    };

// Initialize
(() => {
    if (getArg("production")) {
        wp.mode = "production";
        
        wp.plugins.push(
            new MinifyPlugin({
                // Disable consecutive adds, it makes too many assumptions
                consecutiveAdds: false
            }, {})
        );
        
        delete wp.devtool;
    }
})();

module.exports = wp;
