const path = require('path');

function fixImportsAndRequires(code, functionData) {
    let functionLookup = {};
    functionLookup[functionData.functionName] = functionData.exportedAsObject;

    functionData.relatedCode.forEach(func => {
        (func.functionNames || []).forEach(f => {
            functionLookup[f] = func.exportedAsObject;
        });
    });

    const importPattern = /(import\s+((\{\s*(\w+)\s*\})|(.*))\s+from\s+'(\..*)';?\n?)/g;
    const requirePattern = /((var|const|let)\s+((\{\s*(\w+)\s*\})|(.*))\s+=\s+require\('(\..*)'\)(\.default)?(\.\w+)?;?\n?)/g;

    let imports = '';
    let newCode = code;

    let requireMatches = [...newCode.matchAll(requirePattern)];
    requireMatches = requireMatches.map(match => {
        return {
            fullStatement: match[1],
            importedElement: match[3],
            path: match[7]
        }
    });
    let importMatches = [...newCode.matchAll(importPattern)];
    importMatches = importMatches.map(match => {
        return {
            fullStatement: match[1],
            importedElement: match[2],
            path: match[6]
        }
    });

    let importedFunctions = [];

    requireMatches.concat(importMatches).forEach((match) => {
        let parsedPath = path.parse(match.path);
        let pathNoExtension = path.join(parsedPath.dir, parsedPath.name);

        let defaultImports = [];
        let namedImports = [];

        if (match.importedElement.includes('{') && match.importedElement.includes('}')) {
            // both default and named imports exist
            const splitElements = match.importedElement.split(',');

            // first element is default import
            defaultImports.push(splitElements[0].trim());

            // rest are named imports
            const namedElements = splitElements.slice(1).join(',');
            namedImports.push(...namedElements.replace(/\{|\}/g, '').split(',').map(func => func.trim()));
        } else {
            // only default or named imports
            const functionNames = match.importedElement.startsWith('{')
                ? match.importedElement.replace(/\{|\}/g, '').split(',').map(func => func.trim())
                : [match.importedElement.trim()];

            functionNames.forEach(functionName => {
                if (functionLookup.hasOwnProperty(functionName) && !functionLookup[functionName]) {
                    defaultImports.push(functionName);
                } else {
                    namedImports.push(functionName);
                }
            });
        }

        let correctedStatements = '';
        if (functionData.isES6Syntax) {
            if (namedImports.length > 0) {
                correctedStatements += `import { ${namedImports.join(', ')} } from '${pathNoExtension}';\n`;
            }
            if (defaultImports.length > 0) {
                correctedStatements += `import ${defaultImports.join(', ')} from '${pathNoExtension}';\n`;
            }
        } else {
            if (namedImports.length > 0) {
                correctedStatements += `let { ${namedImports.join(', ')} } = require('${pathNoExtension}');\n`;
            }
            if (defaultImports.length > 0) {
                correctedStatements += `let ${defaultImports.join(', ')} = require('${pathNoExtension}';\n`;
            }
        }

        if (!importedFunctions.includes([...defaultImports, ...namedImports].join(', '))) {
            newCode = newCode.replace(match.fullStatement, '');
            imports += correctedStatements;
            importedFunctions.push([...defaultImports, ...namedImports].join(', '));
        }
    });

    newCode = imports + '\n' + newCode.trim();

    return newCode;
}

function cleanupGPTResponse(gptResponse) {
    if (gptResponse.substring(0, 3) === "```") {
        gptResponse = gptResponse.substring(gptResponse.indexOf('\n') + 1, gptResponse.lastIndexOf('```'));
    }

    return gptResponse;
}

module.exports = {
    fixImportsAndRequires,
    cleanupGPTResponse
}
