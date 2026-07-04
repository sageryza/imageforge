import UIKit

/// Cuts a finished sticker sheet into per-sticker bounding boxes, so a sheet
/// pulled back out of the gallery can be re-opened in the tap-to-redo editor.
///
/// This is a direct port of the backend's `segmentStickerSheet` (pure pixel
/// analysis — downscale, threshold, dilate, connected components), so boxes
/// match what generation would have produced. Runs entirely on-device.
enum StickerSegmenter {
    static func boxes(from image: UIImage) -> [StickerBox] {
        guard let cg = image.cgImage, cg.width > 0, cg.height > 0 else { return [] }
        let W0 = cg.width, H0 = cg.height
        let AW = 384
        let AH = max(1, Int((Double(H0) / Double(W0)) * Double(AW)))
        let w = AW, h = AH, n = w * h

        // Render a greyscale, top-left-origin copy at analysis resolution. Fill
        // white first so any transparency reads as background; flip vertically so
        // memory row 0 is the TOP of the sheet (matches CGImage crop coords).
        var buf = [UInt8](repeating: 255, count: n)
        let gray = CGColorSpaceCreateDeviceGray()
        guard let ctx = CGContext(data: &buf, width: w, height: h, bitsPerComponent: 8,
                                  bytesPerRow: w, space: gray,
                                  bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return [] }
        ctx.setFillColor(gray: 1, alpha: 1)
        ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
        ctx.translateBy(x: 0, y: CGFloat(h))
        ctx.scaleBy(x: 1, y: -1)
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))

        // Foreground = darker than near-white.
        var fg = [UInt8](repeating: 0, count: n)
        for i in 0..<n { fg[i] = buf[i] < 238 ? 1 : 0 }

        // Dilate (separable max filter, radius r) to close line-art gaps.
        let r = 4
        var tmp = [UInt8](repeating: 0, count: n)
        var dil = [UInt8](repeating: 0, count: n)
        for y in 0..<h {
            for x in 0..<w {
                var m: UInt8 = 0
                var dx = -r
                while dx <= r { let xx = x + dx; if xx >= 0, xx < w, fg[y*w+xx] == 1 { m = 1; break }; dx += 1 }
                tmp[y*w+x] = m
            }
        }
        for y in 0..<h {
            for x in 0..<w {
                var m: UInt8 = 0
                var dy = -r
                while dy <= r { let yy = y + dy; if yy >= 0, yy < h, tmp[yy*w+x] == 1 { m = 1; break }; dy += 1 }
                dil[y*w+x] = m
            }
        }

        // Connected components (BFS, 8-connected).
        var lab = [Int32](repeating: 0, count: n)
        var qx = [Int](repeating: 0, count: n)
        var qy = [Int](repeating: 0, count: n)
        var cur: Int32 = 0
        struct Comp { var minx, miny, maxx, maxy, area: Int }
        var comps: [Comp] = []
        for y in 0..<h {
            for x in 0..<w {
                let idx = y*w + x
                if dil[idx] == 0 || lab[idx] != 0 { continue }
                cur += 1
                var head = 0, tail = 0
                qx[tail] = x; qy[tail] = y; tail += 1; lab[idx] = cur
                var minx = x, maxx = x, miny = y, maxy = y, area = 0
                while head < tail {
                    let cx = qx[head], cy = qy[head]; head += 1; area += 1
                    if cx < minx { minx = cx }; if cx > maxx { maxx = cx }
                    if cy < miny { miny = cy }; if cy > maxy { maxy = cy }
                    for dy in -1...1 {
                        for dx in -1...1 {
                            let nx = cx + dx, ny = cy + dy
                            if nx < 0 || ny < 0 || nx >= w || ny >= h { continue }
                            let ni = ny*w + nx
                            if dil[ni] == 1, lab[ni] == 0 { lab[ni] = cur; qx[tail] = nx; qy[tail] = ny; tail += 1 }
                        }
                    }
                }
                comps.append(Comp(minx: minx, miny: miny, maxx: maxx, maxy: maxy, area: area))
            }
        }

        let padA = 6
        let minArea = Double(n) * 0.0008
        return comps
            .filter { Double($0.area) > minArea }           // drop speckle noise
            .sorted { $0.area > $1.area }                    // largest first
            .map { c in
                let x0 = max(0, c.minx - padA), y0 = max(0, c.miny - padA)
                let x1 = min(w, c.maxx + padA), y1 = min(h, c.maxy + padA)
                return StickerBox(xPct: Double(x0) / Double(w), yPct: Double(y0) / Double(h),
                                  wPct: Double(x1 - x0) / Double(w), hPct: Double(y1 - y0) / Double(h))
            }
    }
}
