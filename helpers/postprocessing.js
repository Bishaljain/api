const path = require('path');

const extensions =  ['.js', '.ts', '.jsx', '.tsx'];

function fixImportsAndRequires(code, functionData) {
    let functionLookup = {};
    functionLookup[functionData.functionName] = functionData.exportedAsObject;

    functionData.relatedCode.forEach(func => {
        (func.functionNames || []).forEach(f => {
            functionLookup[f] = func.exportedAsObject;
        });
        functionLookup[func.funcName] = func.exportedAsObject;
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
        let pathNoExtension;
        

        if (extensions.includes(parsedPath.ext)) {
            pathNoExtension = path.join(parsedPath.dir, parsedPath.name);
        } else {
            pathNoExtension = path.join(parsedPath.dir, parsedPath.base);
        }
  
        const functionName = match.importedElement.startsWith('{') ? match.importedElement.replace(/\{|\}/g, '').trim() : match.importedElement.trim();
        const isExportedAsObject = functionLookup[functionName] || false;

        let correctedStatement;
        if (functionData.isES6Syntax) {
            correctedStatement = isExportedAsObject
                ? `import { ${functionName} } from '${pathNoExtension}';`
                : `import ${functionName} from '${pathNoExtension}';`;
        } else {
            correctedStatement = isExportedAsObject
                ? `let { ${functionName} } = require('${pathNoExtension}');`
                : `let ${functionName} = require('${pathNoExtension}');`;
        }

        if (!importedFunctions.includes(functionName)) {
            newCode = newCode.replace(match.fullStatement, '');
            imports += correctedStatement + '\n';
            importedFunctions.push(functionName);
        }
    });

    newCode = imports + '\n' + newCode.trim();

    return newCode;
}

function rearrangeImports(code) {
    const importAndRequireRegex = /^(import .+ from .+;|const .+ = require\(.+\);?)[\r\n]*/gm;
    let extractedStatements = code.match(importAndRequireRegex);
    let codeExcludingStatements = code.replace(importAndRequireRegex, '');
    extractedStatements = [...new Set(extractedStatements.map(statement => statement.trim()))];
    let consolidatedStatements = extractedStatements.join('\n');
    let codeWithReorderedStatements = `${consolidatedStatements}\n\n${codeExcludingStatements}`;

    return codeWithReorderedStatements;
}

function cleanupGPTResponse(gptResponse) {
    if (gptResponse.substring(0, 3) === "```") {
        gptResponse = gptResponse.substring(gptResponse.indexOf('\n') + 1, gptResponse.lastIndexOf('```'));
    }

    return gptResponse;
}

module.exports = {
    fixImportsAndRequires,
    rearrangeImports,
    cleanupGPTResponse
}
