import SwiftUI
import UIKit

/// A real page-turn book: wraps `UIPageViewController` with the `.pageCurl`
/// transition so pages flip like a physical book (SwiftUI's TabView only
/// slides). Drag from the page edge to turn.
struct PageCurlBook<Page: View>: UIViewControllerRepresentable {
    var count: Int
    @Binding var index: Int
    @ViewBuilder var page: (Int) -> Page

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIViewController(context: Context) -> UIPageViewController {
        let pvc = UIPageViewController(transitionStyle: .pageCurl,
                                      navigationOrientation: .horizontal)
        pvc.dataSource = context.coordinator
        pvc.delegate = context.coordinator
        pvc.view.backgroundColor = .clear
        if count > 0 {
            let start = min(max(index, 0), count - 1)
            pvc.setViewControllers([context.coordinator.controller(for: start)],
                                   direction: .forward, animated: false)
        }
        return pvc
    }

    func updateUIViewController(_ pvc: UIPageViewController, context: Context) {
        context.coordinator.parent = self
        guard count > 0 else { return }
        let target = min(max(index, 0), count - 1)
        let currentIdx = pvc.viewControllers?.first.flatMap { context.coordinator.index(of: $0) }
        // Refresh the visible page's content (e.g. an image finished loading).
        if let vc = pvc.viewControllers?.first as? UIHostingController<Page>, let i = currentIdx {
            vc.rootView = page(i)
        }
        if currentIdx != target {
            let dir: UIPageViewController.NavigationDirection =
                (currentIdx ?? 0) <= target ? .forward : .reverse
            pvc.setViewControllers([context.coordinator.controller(for: target)],
                                   direction: dir, animated: true)
        }
    }

    final class Coordinator: NSObject, UIPageViewControllerDataSource, UIPageViewControllerDelegate {
        var parent: PageCurlBook
        private var cache: [Int: UIHostingController<Page>] = [:]
        init(_ p: PageCurlBook) { parent = p }

        func controller(for i: Int) -> UIHostingController<Page> {
            if let c = cache[i] { c.rootView = parent.page(i); return c }
            let c = UIHostingController(rootView: parent.page(i))
            c.view.backgroundColor = .clear
            cache[i] = c
            return c
        }

        func index(of vc: UIViewController) -> Int? {
            cache.first(where: { $0.value === vc })?.key
        }

        func pageViewController(_ pvc: UIPageViewController,
                                viewControllerBefore vc: UIViewController) -> UIViewController? {
            guard let i = index(of: vc), i > 0 else { return nil }
            return controller(for: i - 1)
        }

        func pageViewController(_ pvc: UIPageViewController,
                                viewControllerAfter vc: UIViewController) -> UIViewController? {
            guard let i = index(of: vc), i < parent.count - 1 else { return nil }
            return controller(for: i + 1)
        }

        func pageViewController(_ pvc: UIPageViewController, didFinishAnimating finished: Bool,
                                previousViewControllers: [UIViewController],
                                transitionCompleted completed: Bool) {
            if completed, let vc = pvc.viewControllers?.first, let i = index(of: vc) {
                parent.index = i
            }
        }
    }
}
