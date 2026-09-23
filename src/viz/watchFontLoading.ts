/* The mono face is bundled by @fontsource and loads asynchronously, so a first
   visit with a cold cache paints the canvas before it arrives: the labels are
   measured and drawn in the fallback family. Nothing tells the canvas when the
   real face lands, because no resize, devicePixelRatio change or theme change
   happened, so the fallback stays until something else forces a redraw.
   `loadingdone` is that signal. It fires once per batch of faces, which covers
   both the initial load and any face that loads later. A set that finished
   loading before the canvas was built fires nothing, which is correct: that
   paint already used the real face. */
export function watchFontLoading(onChange: () => void): () => void {
  document.fonts.addEventListener('loadingdone', onChange)
  return () => {
    document.fonts.removeEventListener('loadingdone', onChange)
  }
}
