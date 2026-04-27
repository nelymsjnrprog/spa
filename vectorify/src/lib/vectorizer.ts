import ImageTracer from 'imagetracerjs';

export interface VectorizeOptions {
  colors: number;
  ltres: number; // line threshold
  qtres: number; // quadratic threshold
  strokewidth: number;
  blurradius: number;
  blurdelta: number;
}

export const defaultOptions: VectorizeOptions = {
  colors: 8,
  ltres: 1,
  qtres: 1,
  strokewidth: 0.5,
  blurradius: 0,
  blurdelta: 20
};

export const vectorizeImage = async (
  imageSrc: string, 
  options: VectorizeOptions = defaultOptions
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // ImageTracer.imageToSVG works with URL/DataURL
      ImageTracer.imageToSVG(
        imageSrc,
        (svgString: string) => {
          resolve(svgString);
        },
        {
          numberofcolors: options.colors,
          ltres: options.ltres,
          qtres: options.qtres,
          strokewidth: options.strokewidth,
          blurradius: options.blurradius,
          blurdelta: options.blurdelta,
          viewbox: true,
          linefilter: true
        }
      );
    } catch (error) {
      reject(error);
    }
  });
};

export const downloadSVG = (svgContent: string, fileName: string) => {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.replace(/\.[^/.]+$/, "") + ".svg";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};
