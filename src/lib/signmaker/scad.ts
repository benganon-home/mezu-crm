// The parametric door-sign template, as a string for OpenSCAD-WASM.
// Mirrors the standalone SignMaker's templates/doorsign.scad exactly.

export const DOORSIGN_SCAD = `
base_model    = "/base.stl";
text_svg      = "/text.svg";

depth         = 2.1;
svg_scale     = 0.4;
z_offset      = 9.0;
base_offset_x = -125;
base_offset_y = -50;
text_offset_y = 0;

difference() {
    // Blank sign. Do NOT use import(center=true) — newer OpenSCAD centers 3D STL
    // imports on all axes; the base_offset values do the centering instead.
    translate([base_offset_x, base_offset_y, 0])
        import(base_model);

    // Subtract the extruded text from the top face.
    // dpi=25.4 → 1 SVG unit = 1 mm, matching the three.js preview.
    translate([0, text_offset_y, z_offset - depth + 0.1]) {
        linear_extrude(height = depth) {
            scale([svg_scale, svg_scale, 1])
                import(text_svg, center = true, dpi = 25.4);
        }
    }
}
`;
