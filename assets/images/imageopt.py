from io import BytesIO
from PIL import Image
from pathlib import Path
from base64 import b64encode


def image_to_data_url(image, format):
    image_bytes = BytesIO()
    image.save(image_bytes, format)
    image_bytes.seek(0)
    return f"data:image/{format};base64,{b64encode(image_bytes.read()).decode('ascii')}"


for png in list(Path(".").glob("*.png")):
    print("processing " + str(png))
    image = Image.open(str(png))
    alpha = image.getchannel("A")
    svgname = png.stem + ".svg"
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {image.width} {image.height}">
		<defs>
			<mask id="alphamask"><image href="{image_to_data_url(alpha, 'png')}" /></mask>
		</defs>
		<image href="{image_to_data_url(image.convert("RGB"), 'jpeg')}" mask="url(#alphamask)" />
	</svg>'''
    with open(svgname, "w+") as svg_file:
        svg_file.write(svg)
print("complete")
