// Import required classes
importClass(Packages.ij.IJ);
importClass(Packages.ij.WindowManager);
importClass(Packages.java.io.FileWriter);
importClass(Packages.java.io.BufferedWriter);
importClass(Packages.fiji.util.gui.GenericDialogPlus);

// Global variables
var deconvolutionMatrix = [
    [0.41607487, 0.8534002, 0.31399015], // Channel 1
    [0.5841384, 0.60622144, 0.53970164], // Channel 2
    [0.6657374, 0.001, 0.746186] // Channel 3
];
var histogramData = [];
var inputFolder = "C:/Users/sebas/Desktop/test2";
var outputFile = "";
var totalImages = 0;
var processedImages = 0;

// Function to get user input
function getUserInput() {
    var gd = new GenericDialogPlus("PAS Deconvolution Analysis");
    
    // Add description
    gd.addMessage("This script will:\n" +
                 "1. Perform color deconvolution on all images in selected folder\n" +
                 "2. Measure histograms for each channel\n" +
                 "3. Save results to a CSV file");
    
    // Add input fields
    gd.addDirectoryField("Input folder:", "");
    gd.addStringField("Output filename:", "histograms.csv");
    
    gd.showDialog();
    
    if (gd.wasCanceled()) {
        return null;
    }
    
    return {
        inputFolder: gd.getNextString(),
        outputFile: gd.getNextString()
    };
}

// Main function to run the analysis
function main() {
    // Get user input
    var userInput = getUserInput();
    if (!userInput) {
        print("Analysis cancelled by user");
        return;
    }

    inputFolder = userInput.inputFolder;
    // Ensure output file is in the input folder
    outputFile = inputFolder + java.io.File.separator + userInput.outputFile;

    // Validate paths
    if (!new java.io.File(inputFolder).exists()) {
        IJ.error("Input folder does not exist: " + inputFolder);
        return;
    }

    // Clear any previous data
    histogramData = [];
    totalImages = 0;
    processedImages = 0;

// Function to measure histogram of a deconvolved image
function measureHistogram(imp, imageName) {
    // Run the Colour Deconvolution command using the defined matrix
    IJ.run(imp, "Colour Deconvolution", "vectors=[User values] " +
      "[r1]=" + deconvolutionMatrix[0][0] + " [g1]=" + deconvolutionMatrix[0][1] + " [b1]=" + deconvolutionMatrix[0][2] + " " +
      "[r2]=" + deconvolutionMatrix[1][0] + " [g2]=" + deconvolutionMatrix[1][1] + " [b2]=" + deconvolutionMatrix[1][2] + " " +
      "[r3]=" + deconvolutionMatrix[2][0] + " [g3]=" + deconvolutionMatrix[2][1] + " [b3]=" + deconvolutionMatrix[2][2]);

    // Get the deconvolved images
    var title = imp.getTitle();
    var imp1 = WindowManager.getImage(title + "-(Colour_1)");
    var imp2 = WindowManager.getImage(title + "-(Colour_2)");
    var imp3 = WindowManager.getImage(title + "-(Colour_3)");

    // Get histograms for each channel
    var hist1 = imp1.getProcessor().getHistogram();
    var hist2 = imp2.getProcessor().getHistogram();
    var hist3 = imp3.getProcessor().getHistogram();

    // Store histogram data
    histogramData.push({
        name: imageName,
        channel1: hist1,
        channel2: hist2,
        channel3: hist3
    });

    // Close the deconvolved images
    imp1.close();
    imp2.close();
    imp3.close();
}

// Function to process all images in a folder
function processFolder(inputFolder) {
    print("Processing folder: " + inputFolder);
    // Get a list of all files in the input folder using Java's File object
    var folder = new java.io.File(inputFolder);
    var fileList = folder.listFiles();

    print("Found " + fileList.length + " files.");

    // Iterate over all files
    for (var i = 0; i < fileList.length; i++) {
        var file = fileList[i];

        print("Checking file: " + file.getAbsolutePath());

        // Check if it's a file (not a directory) and an image file
        if (file.isFile() && (file.getName().endsWith(".png") || file.getName().endsWith(".jpg") || file.getName().endsWith(".jpeg") || file.getName().endsWith(".tif") || file.getName().endsWith(".tiff"))) {
            print("Processing image: " + file.getName());

            // Open the image
            var imp = IJ.openImage(file.getAbsolutePath());

            if (imp === null) {
                print("Error: Could not open image " + file.getAbsolutePath());
                continue;
            }

            // Measure histogram of the image
            print("Processing " + file.getName() + "...");
            measureHistogram(imp, file.getName());
            print("Finished " + file.getName());

            // Close the original image
            imp.close();
        } else {
            print("Skipping non-image file: " + file.getName());
        }
    }
}

// Function to calculate statistics from histogram
function calculateStats(histogram) {
    var total = 0;
    var sum = 0;
    var sumSq = 0;
    
    // Calculate mean and total
    for (var i = 0; i <= 250; i++) {
        total += histogram[i];
        sum += i * histogram[i];
    }
    var mean = sum / total;
    
    // Calculate standard deviation
    for (var i = 0; i <= 250; i++) {
        sumSq += Math.pow(i - mean, 2) * histogram[i];
    }
    var stdDev = Math.sqrt(sumSq / total);
    
    // Calculate median
    var medianCount = Math.floor(total / 2);
    var currentCount = 0;
    var median = 0;
    for (var i = 0; i <= 250; i++) {
        currentCount += histogram[i];
        if (currentCount >= medianCount) {
            median = i;
            break;
        }
    }
    
    return {
        mean: mean.toFixed(2),
        stdDev: stdDev.toFixed(2),
        median: median
    };
}

// Function to save histogram data to CSV
function saveHistogramToCSV() {
    var writer = new BufferedWriter(new FileWriter(outputFile));
    
    // Write header
    writer.write("Intensity");
    for (var i = 0; i < histogramData.length; i++) {
        writer.write(",Count_" + histogramData[i].name);
    }
    writer.write("\n");
    
    // Write data for each intensity value (0-250)
    for (var intensity = 0; intensity <= 250; intensity++) {
        writer.write(intensity.toString());
        
        // Write count for each image at this intensity
        for (var i = 0; i < histogramData.length; i++) {
            writer.write("," + histogramData[i].channel1[intensity]);
        }
        writer.write("\n");
    }
    
    // Add empty row as separator
    writer.write("\n");
    
    // Write statistics for each image
    writer.write("Mean");
    for (var i = 0; i < histogramData.length; i++) {
        var stats = calculateStats(histogramData[i].channel1);
        writer.write("," + stats.mean);
    }
    writer.write("\n");
    
    writer.write("StdDev");
    for (var i = 0; i < histogramData.length; i++) {
        var stats = calculateStats(histogramData[i].channel1);
        writer.write("," + stats.stdDev);
    }
    writer.write("\n");
    
    writer.write("Median");
    for (var i = 0; i < histogramData.length; i++) {
        var stats = calculateStats(histogramData[i].channel1);
        writer.write("," + stats.median);
    }
    writer.write("\n");
    
    writer.close();
}


    // Process the folder
    processFolder(inputFolder);

    // Save the histogram data
    saveHistogramToCSV();

    print("Histogram analysis completed.");
    print("Input folder: " + inputFolder);
    print("Output file: " + outputFile);
}

// Run the main function
main();
