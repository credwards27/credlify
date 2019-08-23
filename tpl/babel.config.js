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
            "@babel/plugin-transform-async-to-generator",
            
            [
                "@babel/plugin-transform-runtime",
                {
                    helpers: false
                }
            ],
            
            [
                "babel-plugin-root-import",
                {
                    "rootPathSuffix": CONFIG.PATH.SRC.JS,
                    "rootPathPrefix": "~"
                }
            ]
        ],
        
        sourceType: "unambiguous"
    };
}
