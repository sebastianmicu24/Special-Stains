importClass(Packages.ij.IJ);
importClass(Packages.ij.ImagePlus);
importClass(Packages.ij.WindowManager);
importClass(Packages.ij.gui.GenericDialog);

// Global threshold values
var imp1Threshold = 150;
var imp3Threshold = 150;

// Deconvolution parameters
var r1 = 20.352661;
var g1 = 98.67872;
var b1 = 61.333855;
var r2 = 23.119661;
var g2 = 35.17482;
var b2 = 22.153309;
var r3 = 10.03157;
var g3 = 11.157111;
var b3 = 11.05758;

function getDeconvolutionValues() {
    var gd = new GenericDialog("Set Deconvolution Parameters");
    gd.addNumericField("R1:", r1, 6);
    gd.addNumericField("G1:", g1, 6);
    gd.addNumericField("B1:", b1, 6);
    gd.addNumericField("R2:", r2, 6);
    gd.addNumericField("G2:", g2, 6);
    gd.addNumericField("B2:", b2, 6);
    gd.addNumericField("R3:", r3, 6);
    gd.addNumericField("G3:", g3, 6);
    gd.addNumericField("B3:", b3, 6);
    gd.showDialog();
    
    if (gd.wasCanceled()) {
        IJ.log("Deconvolution parameters dialog canceled, using default values");
        return;
    }
    
    r1 = gd.getNextNumber();
    g1 = gd.getNextNumber();
    b1 = gd.getNextNumber();
    r2 = gd.getNextNumber();
    g2 = gd.getNextNumber();
    b2 = gd.getNextNumber();
    r3 = gd.getNextNumber();
    g3 = gd.getNextNumber();
    b3 = gd.getNextNumber();
}

function getThresholdValues() {
    var gd = new GenericDialog("Set Threshold Values");
    gd.addNumericField("Colour_1 Upper Threshold:", imp1Threshold, 0);
    gd.addNumericField("Colour_3 Upper Threshold:", imp3Threshold, 0);
    gd.showDialog();
    
    if (gd.wasCanceled()) {
        IJ.log("Threshold dialog canceled, using default values");
        return;
    }
    
    imp1Threshold = gd.getNextNumber();
    imp3Threshold = gd.getNextNumber();
}

function processImage(imp) {
    var title = imp.getTitle();
    
    // Perform color deconvolution
    IJ.run(imp, "Colour Deconvolution", "vectors=[User values] " +
        "[r1]=" + r1 + " [g1]=" + g1 + " [b1]=" + b1 + " " +
        "[r2]=" + r2 + " [g2]=" + g2 + " [b2]=" + b2 + " " +
        "[r3]=" + r3 + " [g3]=" + g3 + " [b3]=" + b3);

    // Process Colour_1 channel
    var color1Title = title + "-(Colour_1)";
    var color1Imp = WindowManager.getImage(color1Title);
    if (!color1Imp) {
        IJ.log("Error: Could not find Colour_1 image: " + color1Title);
        return;
    }

   
    
    IJ.run(color1Imp, "8-bit", "");
    IJ.setThreshold(color1Imp, 0, imp1Threshold);
    IJ.run(color1Imp, "Convert to Mask", "");

    var color2Title = title + "-(Colour_2)";
    var color2Imp = WindowManager.getImage(color2Title);
    if (!color2Imp) {
        IJ.log("Error: Could not find Colour_1 image: " + color2Title);
        return;
    }
    color2Imp.close();

    // Process Colour_3 channel
    var color3Title = title + "-(Colour_3)";
    var color3Imp = WindowManager.getImage(color3Title);
    if (!color3Imp) {
        IJ.log("Warning: Could not find Colour_3 image: " + color3Title);
        return;
    }
    var colDec = WindowManager.getImage("Colour Deconvolution");
    colDec.close()

    IJ.run(color3Imp, "8-bit", "");
    IJ.setThreshold(color3Imp, 0, imp3Threshold);
    IJ.run(color3Imp, "Convert to Mask", "");
    
    // Create stack with original and thresholded images
    // IJ.selectWindow(imp.getTitle());
    IJ.selectWindow(color1Imp.getTitle());
    IJ.selectWindow(color3Imp.getTitle());
    IJ.run("Images to Stack", "title=");
}

function main() {
    // Get threshold values from user
    getThresholdValues();
    getDeconvolutionValues();
    
    // Open single image
    var imp = IJ.openImage();
    if (!imp) {
        IJ.log("No image selected");
        return;
    }
    imp.show()
    
    processImage(imp);
}

main();
