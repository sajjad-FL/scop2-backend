const fs = require('fs');
const path = require('path');

/**
 * @method importModule
 *
 * @description read file from given path
 * @param filePath file path
 * @param contentType file content type
 * @returns ReadStream
 */
const importModule = (filePath, contentType) => fs.readFileSync(path.resolve(__dirname, filePath), contentType);

module.exports = {
  TMEDSTemplateHtml: {
    skeletonRmd: importModule('./TMEDSTemplateHtml/skeleton.Rmd', 'utf-8'),
    jsnLogoPng: importModule('./TMEDSTemplateHtml/jsn_logo_color_rgb.png', 'base64'),
    americanStatisticalAssociationCsl: importModule('./TMEDSTemplateHtml/lib/american-statistical-association.csl', 'utf-8'),
    exampleBib: importModule('./TMEDSTemplateHtml/lib/exampleBib.bib', 'utf-8'),
    stylesArialCss: importModule('./TMEDSTemplateHtml/lib/stylesArial.css', 'utf-8'),
  },
  TMEDSTemplateWord: {
    skeletonRmd: importModule('./TMEDSTemplateWord/skeleton.Rmd', 'utf-8'),
    skeletonDocx: importModule('./TMEDSTemplateWord/skeleton.docx', 'base64'),
    americanStatisticalAssociationCsl: importModule('./TMEDSTemplateWord/lib/american-statistical-association.csl', 'utf-8'),
    exampleBib: importModule('./TMEDSTemplateWord/lib/exampleBib.bib', 'utf-8'),
    reportTemplateCalibriDocx: importModule('./TMEDSTemplateWord/lib/ReportTemplateCalibri.docx', 'base64'),
    stylesArialCss: importModule('./TMEDSTemplateWord/lib/stylesArial.css', 'utf-8'),
  },
};