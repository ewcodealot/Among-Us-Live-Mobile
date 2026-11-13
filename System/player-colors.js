(function(root) {
    function getRelativeLuminance(color) {
        if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return null;

        const channels = color.slice(1).match(/.{2}/g).map(channel =>
            parseInt(channel, 16) / 255
        );
        const linearChannels = channels.map(channel =>
            channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
        );
        return linearChannels[0] * 0.2126 +
            linearChannels[1] * 0.7152 +
            linearChannels[2] * 0.0722;
    }

    function isValidPlayerColor(color) {
        const luminance = getRelativeLuminance(color);
        return luminance !== null && luminance <= 0.55;
    }

    function getPlayerTextColor(backgroundColor) {
        const luminance = getRelativeLuminance(backgroundColor);
        return luminance !== null && luminance > 0.179 ? '#000000' : '#ffffff';
    }

    function randomPlayerColor() {
        const hue = Math.random() * 360;
        const saturation = 90;
        const lightness = 42;
        const chroma = (1 - Math.abs(2 * lightness / 100 - 1)) * saturation / 100;
        const hueSegment = hue / 60;
        const secondChannel = chroma * (1 - Math.abs(hueSegment % 2 - 1));
        const [red, green, blue] = hueSegment < 1
            ? [chroma, secondChannel, 0]
            : hueSegment < 2
                ? [secondChannel, chroma, 0]
                : hueSegment < 3
                    ? [0, chroma, secondChannel]
                    : hueSegment < 4
                        ? [0, secondChannel, chroma]
                        : hueSegment < 5
                            ? [secondChannel, 0, chroma]
                            : [chroma, 0, secondChannel];
        const offset = lightness / 100 - chroma / 2;
        const toHex = channel => Math.round((channel + offset) * 255)
            .toString(16).padStart(2, '0');
        const color = `#${toHex(red)}${toHex(green)}${toHex(blue)}`;

        return isValidPlayerColor(color) ? color : randomPlayerColor();
    }

    root.PlayerColors = {
        getPlayerTextColor,
        isValidPlayerColor,
        randomPlayerColor
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = root.PlayerColors;
    }
})(typeof window === 'undefined' ? globalThis : window);
