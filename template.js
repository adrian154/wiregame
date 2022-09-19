// super shitty template system

const sanitize = str => String(str).replaceAll('&', '&amp;')
                                   .replaceAll('<', '&lt;')
                                   .replaceAll('>', '&gt;')
                                   .replaceAll('"', '&quot;')
                                   .replaceAll("'", '&#39;')
                                   .replaceAll('$', '&#36;');

const render = (template, vars) => {
    let str = template;
    for(const variable in vars) {
        str = str.replaceAll("$" + variable, sanitize(vars[variable]));
    }
    return str;
};

module.exports = render;