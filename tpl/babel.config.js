/* babel.config.js
    
    Babel configuration.
*/

// Dependencies.
const CONFIG = require("./config");

module.exports = function(api) {
    api.cache(true);
    
    return {
        presets: [ "@babel/preset-env" ],
        plugins: [
            "@babel/plugin-proposal-class-properties",
            "@babel/plugin-proposal-object-rest-spread",
            "@babel/plugin-proposal-export-default-from",
            "@babel/plugin-syntax-dynamic-import",
            
            [
                "babel-plugin-root-import",
                {
                    "rootPathSuffix": CONFIG.PATH.SRC.JS,
                    "rootPathPrefix": "~"
                }
            ],
        ]
    };
}
