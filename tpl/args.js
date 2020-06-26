/* args.js
    
    Arguments configuration.
*/

// Dependencies.
const minimist = require("minimist"),
    minimistOpts = require("minimist"),
    
    // Argument configuration.
    ARG_OPTS = {
        production: {
            type: "boolean",
            default: false
        }
    },
    
    // Object containing command line arguments.
    ARGS = getArg();

/* Gets one or all command line arguments.
    
    arg - Specific argument name to retrieve. If omitted, all arguments are
        returned.
    
    Returns a single argument value, or an object containing all arguments and
    their values.
*/
function getArg(arg) {
    let args = ARGS || minimist(process.argv.slice(2), minimistOpts(ARG_OPTS));
    return arg ? args[arg] : args;
}

module.exports = getArg;
