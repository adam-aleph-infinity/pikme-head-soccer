// Cut the person out of a card photo with macOS Vision, and find their face.
//
//   swift tools/chars/vision-matte.swift <in.png> <outdir>
//
// Writes, at the input's resolution:
//   <outdir>/lift.png    VNGenerateForegroundInstanceMaskRequest (the Photos "lift subject" matte),
//                        only the instance under the face centre (so props/snakes are dropped)
//   <outdir>/person.png  VNGeneratePersonSegmentationRequest, quality .accurate (soft hair edges)
//   <outdir>/face.json   face box + the 76-point landmarks, in image pixels, origin top-left
// Both mattes are 8-bit grey PNGs (255 = person). tools/chars/build-real.py combines them.
import Foundation
import Vision
import CoreImage
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: vision-matte.swift in.png outdir"); exit(2) }
let inURL = URL(fileURLWithPath: args[1])
let outDir = URL(fileURLWithPath: args[2])
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

guard let src = CGImageSourceCreateWithURL(inURL as CFURL, nil),
      let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("cannot read"); exit(1) }
let W = cg.width, H = cg.height
let ctx = CIContext(options: [.workingColorSpace: NSNull()])

func writeGray(_ ci: CIImage, _ name: String) {
  // Scale the (possibly lower-res) matte to the image size and write an 8-bit grey PNG.
  let sx = CGFloat(W) / ci.extent.width, sy = CGFloat(H) / ci.extent.height
  let scaled = ci.transformed(by: CGAffineTransform(scaleX: sx, y: sy))
  let cs = CGColorSpaceCreateDeviceGray()
  guard let out = ctx.createCGImage(scaled, from: CGRect(x: 0, y: 0, width: W, height: H),
                                    format: .L8, colorSpace: cs) else { print("render failed \(name)"); return }
  let url = outDir.appendingPathComponent(name)
  let dst = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(dst, out, nil)
  CGImageDestinationFinalize(dst)
  print("wrote \(url.path) (matte \(Int(ci.extent.width))x\(Int(ci.extent.height)))")
}

let handler = VNImageRequestHandler(cgImage: cg, options: [:])

// Face first: its centre picks the instance to keep.
let faceReq = VNDetectFaceLandmarksRequest()
try handler.perform([faceReq])
var faceCenter = CGPoint(x: 0.5, y: 0.6)   // normalised, origin bottom-left
var faceJSON: [String: Any] = [:]
if let f = (faceReq.results ?? []).max(by: { $0.boundingBox.width < $1.boundingBox.width }) {
  let b = f.boundingBox
  faceCenter = CGPoint(x: b.midX, y: b.midY)
  func px(_ p: CGPoint) -> [Double] { [Double(p.x) * Double(W), Double(1 - p.y) * Double(H)] }
  faceJSON["box"] = [Double(b.minX) * Double(W), Double(1 - b.maxY) * Double(H), Double(b.width) * Double(W), Double(b.height) * Double(H)]
  faceJSON["roll"] = f.roll?.doubleValue ?? 0
  faceJSON["yaw"] = f.yaw?.doubleValue ?? 0
  if let lm = f.landmarks {
    var regions: [String: [[Double]]] = [:]
    let named: [(String, VNFaceLandmarkRegion2D?)] = [
      ("contour", lm.faceContour), ("leftEye", lm.leftEye), ("rightEye", lm.rightEye),
      ("leftBrow", lm.leftEyebrow), ("rightBrow", lm.rightEyebrow), ("nose", lm.nose),
      ("noseCrest", lm.noseCrest), ("outerLips", lm.outerLips), ("innerLips", lm.innerLips),
      ("leftPupil", lm.leftPupil), ("rightPupil", lm.rightPupil), ("medianLine", lm.medianLine)]
    for (n, r) in named {
      guard let r = r else { continue }
      regions[n] = r.pointsInImage(imageSize: CGSize(width: W, height: H)).map { [Double($0.x), Double(H) - Double($0.y)] }
    }
    faceJSON["landmarks"] = regions
  }
}
let jd = try JSONSerialization.data(withJSONObject: faceJSON, options: [.prettyPrinted, .sortedKeys])
try jd.write(to: outDir.appendingPathComponent("face.json"))

// Subject lift: keep the instance under the face.
let lift = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([lift])
if let obs = lift.results?.first {
  let mask = obs.instanceMask   // CVPixelBuffer of instance labels, at the observation's res
  CVPixelBufferLockBaseAddress(mask, .readOnly)
  let mw = CVPixelBufferGetWidth(mask), mh = CVPixelBufferGetHeight(mask)
  let row = CVPixelBufferGetBytesPerRow(mask)
  let base = CVPixelBufferGetBaseAddress(mask)!.assumingMemoryBound(to: UInt8.self)
  let fx = min(mw - 1, max(0, Int(faceCenter.x * CGFloat(mw))))
  let fy = min(mh - 1, max(0, Int((1 - faceCenter.y) * CGFloat(mh))))
  let label = Int(base[fy * row + fx])
  CVPixelBufferUnlockBaseAddress(mask, .readOnly)
  let keep: IndexSet = label > 0 ? IndexSet(integer: label) : obs.allInstances
  print("lift: \(obs.allInstances.count) instances, keeping \(Array(keep)) (label at face \(label))")
  let soft = try obs.generateScaledMaskForImage(forInstances: keep, from: handler)
  writeGray(CIImage(cvPixelBuffer: soft), "lift.png")
}

// Person segmentation, accurate.
let person = VNGeneratePersonSegmentationRequest()
person.qualityLevel = .accurate
person.outputPixelFormat = kCVPixelFormatType_OneComponent8
try handler.perform([person])
if let pb = person.results?.first?.pixelBuffer {
  writeGray(CIImage(cvPixelBuffer: pb), "person.png")
}
