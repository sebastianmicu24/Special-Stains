importClass(Packages.ij.IJ);
importClass(Packages.ij.ImagePlus);
importClass(Packages.ij.WindowManager);
importClass(Packages.ij.plugin.frame.RoiManager);
importClass(Packages.ij.measure.ResultsTable);
importClass(Packages.java.io.File);
importClass(Packages.ij.gui.GenericDialog);

// Create a single ResultsTable that will be used for all images
var globalRt = new Packages.ij.measure.ResultsTable();

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
    
    IJ.run(imp, "Set Scale...", "distance=1 known=1 unit=pixel global");

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
    
    // Process mask
    IJ.run(color1Imp, "Analyze Particles...", "size=0-Infinity circularity=0.00-1.00 show=Masks display clear add");
    
    var maskTitle = "Mask of " + title + "-(Colour_1)";
    var maskImp = WindowManager.getImage(maskTitle);
    if (!maskImp) {
        IJ.log("Error: Could not find mask image: " + maskTitle);
        return;
    }

    // Apply mask to original image and get statistics
    maskImp.getProcessor().invert();
    IJ.run(maskImp, "Create Selection", "");
    imp.setRoi(maskImp.getRoi());
    
    var maskStats = Packages.ij.process.ImageStatistics.getStatistics(
        imp.getProcessor(),
        Packages.ij.measure.Measurements.MEAN | 
        Packages.ij.measure.Measurements.STD_DEV | 
        Packages.ij.measure.Measurements.MIN_MAX,
        imp.getCalibration()
    );
    
    // Clean up mask
    maskImp.getProcessor().invert();
        
    // Save ROIs
    var roiManager = RoiManager.getInstance() || new RoiManager();
    var rois = roiManager.getRoisAsArray();
    
    // Set up measurements
    var measurements = Packages.ij.measure.Measurements.AREA;
    
    // Variables for totals
    var totalArea = 0;
    var particleCount = 0;
    
    // Calculate total area and particle count
    for (var i = 0; i < rois.length; i++) {
        var roi = rois[i];
        imp.setRoi(roi);
        var stats = Packages.ij.process.ImageStatistics.getStatistics(
            imp.getProcessor(), 
            measurements, 
            imp.getCalibration()
        );
        
        var area = stats.area * Math.pow(imp.getCalibration().pixelWidth, 2);
        totalArea += area;
        particleCount++;
    }
    
    // Add summary row to global table
    if (rois.length > 0) {
        globalRt.incrementCounter();
        globalRt.addValue("File", title);
        globalRt.addValue("Total Area", totalArea);
        globalRt.addValue("Total Particles", particleCount);
        globalRt.addValue("Mean Area", totalArea / particleCount);
        globalRt.addValue("Mask Mean", maskStats.mean);
        globalRt.addValue("Mask StdDev", maskStats.stdDev);
        globalRt.addValue("Mask Min", maskStats.min);
        globalRt.addValue("Mask Max", maskStats.max);
    }
    
    // Process Colour_3 channel for background area
    var color3Title = title + "-(Colour_3)";
    var color3Imp = WindowManager.getImage(color3Title);
    if (!color3Imp) {
        IJ.log("Warning: Could not find Colour_3 image: " + color3Title);
    } else {
        IJ.log("Processing Colour_3 channel for background area...");
        IJ.run(color3Imp, "8-bit", "");
        IJ.setThreshold(color3Imp, 0, imp3Threshold);
        IJ.run(color3Imp, "Convert to Mask", "");
        
        var bgMaskTitle = title + "-(Colour_3)";
        var bgMaskImp = WindowManager.getImage(bgMaskTitle);
        if (!bgMaskImp) {
            IJ.log("Warning: Could not find background mask image: " + bgMaskTitle);
        }
        
        if (bgMaskImp) {
            // Calculate background area
            var bgRoiManager = RoiManager.getInstance() || new RoiManager();
            var bgRois = bgRoiManager.getRoisAsArray();
            var bgArea = 0;
            
            for (var i = 0; i < bgRois.length; i++) {
                var roi = bgRois[i];
                imp.setRoi(roi);
                var stats = Packages.ij.process.ImageStatistics.getStatistics(
                    imp.getProcessor(), 
                    measurements, 
                    imp.getCalibration()
                );
                bgArea += stats.area * Math.pow(imp.getCalibration().pixelWidth, 2);
            }
            
            // Calculate total image area
            var width = imp.getWidth();
            var height = imp.getHeight();
            var totalImageArea = width * height * Math.pow(imp.getCalibration().pixelWidth, 2);
            
            // Calculate parenchyma area
            var parenchymaArea = totalImageArea - totalArea - bgArea;
            
            // Add new measurements to table
            globalRt.addValue("Background Area", bgArea);
            globalRt.addValue("Parenchyma Area", parenchymaArea);
            
            // Close background windows
            var bgWindowsToClose = [bgMaskTitle, color3Title];
            bgWindowsToClose.forEach(function(windowTitle) {
                var window = WindowManager.getImage(windowTitle);
                if (window) {
                    window.changes = false;
                    window.close();
                }
            });
        }
    }
    
    // Keep original image open
    imp.show();

    // Close all windows in one organized section
    var windowsToClose = [
        title + "-(Colour_2)",
        title + "-(Colour_3)",
        "Colour Deconvolution",
        maskTitle,
        title + "-(Colour_1)"
    ];


    windowsToClose.forEach(function(windowTitle) {
        var window = WindowManager.getImage(windowTitle);
        if (window) {
            window.changes = false;
            window.close();
        }
    });
}

// Recursive function to get all image files in directory and subdirectories
function getImageFiles(dir, basePath) {
    var files = [];
    var dirFiles = dir.listFiles();
    for (var i = 0; i < dirFiles.length; i++) {
        var file = dirFiles[i];
        if (file.isDirectory()) {
            files = files.concat(getImageFiles(file, basePath));
        } else if (file.isFile() && /\.(tif|jpg|png)$/i.test(file.getName())) {
            var relativePath = file.getParent().replace(basePath, "").replace(/\\/g, "/");
            if (relativePath.startsWith("/")) {
                relativePath = relativePath.substring(1);
            }
            files.push({
                file: file,
                path: relativePath
            });
        }
    }
    return files;
}

function main() {
    // Get threshold values from user first
    getThresholdValues();
    getDeconvolutionValues();
    
    // Then select folder with images
    var dc = new Packages.ij.io.DirectoryChooser("Select folder with images");
    var folder = new File(dc.getDirectory());
    var basePath = folder.getAbsolutePath();
    
    // Get all image files recursively
    var files = getImageFiles(folder, basePath);
    
    // Process all images
    for (var i = 0; i < files.length; i++) {
        var fileInfo = files[i];
        var imp = IJ.openImage(fileInfo.file.getAbsolutePath());
        if (imp) {
            // Add path to image title to maintain uniqueness
            var originalTitle = imp.getTitle();
            imp.setTitle(fileInfo.path + "/" + originalTitle);
            
            processImage(imp);
            imp.changes = false;
            imp.close();
        }
    }
    
    // Save the combined results
    if (globalRt.size() > 0) {
        globalRt.save(new File(IJ.getDirectory("current"), "combined_measurements.csv").getAbsolutePath());
    }
}

main();
