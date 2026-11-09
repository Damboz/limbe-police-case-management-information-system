// Minimal ZIP writer (store method, no compression).
//
// The evidence bundle needs to package a generated PDF and the uploaded
// evidence files into one download. The project has no archive dependency and
// the files are already stored on disk, so a small store-only ZIP writer keeps
// the download self-contained without adding a package. "Store" means the
// entries are copied verbatim (no deflate), which every ZIP reader supports.

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    return table;
})();


function crc32(buffer) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buffer.length; i++) {
        crc = CRC_TABLE[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}


// DOS date/time, which is what the ZIP header stores.
function dosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    const dosTime = ((date.getHours() & 0x1F) << 11)
        | ((date.getMinutes() & 0x3F) << 5)
        | ((Math.floor(date.getSeconds() / 2)) & 0x1F);
    const dosDate = (((year - 1980) & 0x7F) << 9)
        | (((date.getMonth() + 1) & 0x0F) << 5)
        | (date.getDate() & 0x1F);
    return { dosTime, dosDate };
}


// entries: [{ name: string, data: Buffer|string }]
function createZip(entries) {
    const localParts = [];
    const centralParts = [];
    const { dosTime, dosDate } = dosDateTime();
    let offset = 0;

    for (const entry of entries) {
        const nameBuffer = Buffer.from(String(entry.name || 'file'), 'utf8');
        const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || '');
        const crc = crc32(data);
        const size = data.length;

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034B50, 0);   // local file header signature
        local.writeUInt16LE(20, 4);           // version needed to extract
        local.writeUInt16LE(0x0800, 6);       // general purpose flag: UTF-8 names
        local.writeUInt16LE(0, 8);            // compression method: store
        local.writeUInt16LE(dosTime, 10);
        local.writeUInt16LE(dosDate, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(size, 18);        // compressed size
        local.writeUInt32LE(size, 22);        // uncompressed size
        local.writeUInt16LE(nameBuffer.length, 26);
        local.writeUInt16LE(0, 28);           // extra field length

        localParts.push(local, nameBuffer, data);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014B50, 0); // central directory signature
        central.writeUInt16LE(20, 4);         // version made by
        central.writeUInt16LE(20, 6);         // version needed
        central.writeUInt16LE(0x0800, 8);     // flags
        central.writeUInt16LE(0, 10);         // method: store
        central.writeUInt16LE(dosTime, 12);
        central.writeUInt16LE(dosDate, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(size, 20);
        central.writeUInt32LE(size, 24);
        central.writeUInt16LE(nameBuffer.length, 28);
        central.writeUInt16LE(0, 30);         // extra
        central.writeUInt16LE(0, 32);         // comment
        central.writeUInt16LE(0, 34);         // disk number
        central.writeUInt16LE(0, 36);         // internal attributes
        central.writeUInt32LE(0, 38);         // external attributes
        central.writeUInt32LE(offset, 42);    // local header offset

        centralParts.push(central, nameBuffer);

        offset += local.length + nameBuffer.length + data.length;
    }

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);

    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054B50, 0);         // end of central directory signature
    end.writeUInt16LE(0, 4);                  // disk number
    end.writeUInt16LE(0, 6);                  // disk with central directory
    end.writeUInt16LE(entries.length, 8);     // entries on this disk
    end.writeUInt16LE(entries.length, 10);    // total entries
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);            // central directory offset
    end.writeUInt16LE(0, 20);                 // comment length

    return Buffer.concat([...localParts, ...centralParts, end]);
}


module.exports = { createZip };
