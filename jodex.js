var net = require('net');
var jParser = require('jParser');
// ^ This also defines jDataView...

var server = net.createServer(function(sock) {
  sock.on('data', function(data) {
    console.log('received ', data.length, ' bytes');
    var parser = new jParser(new jDataView(data), {
      header: {
	      len         : 'uint32',
	      gver        : 'int16',
	      feedback    : 'int16',
	      msgid       : 'uint32',

	      bver        : 'uint32',
	      fieldCount  : 'uint32',
	      recordCount : 'uint32',
	      metaCount   : 'uint32',
	      priority    : 'uint32',
	      statusCode  : 'uint32',

        timeLeft    : 'float64',
      },

      packet: {
        header: 'header',
        offsets: ['array', 'uint32', function() {
          var h = this.current.header;
          return h.fieldCount * (1 + h.recordCount) + 2 * h.metaCount + 1;
        }],

        chunks: function() {
          var offs = this.current.offsets;
          var out = new Array(offs.length - 1);

          for (var i = 1; i < offs.length; i++) {
            var w = offs[i] - offs[i-1];
            out[i-1] = this.parse(['string', w]);
          }
          var skip = 4 - this.tell() % 4;
          console.log('pos:',this.tell(),'padding:',skip);
          if (skip > 0)
            this.parse(['string', skip]);

          // TODO: check buffer length vs this.tell()

          return out;
        },
      }});
    console.log(parser.parse('packet'));
  });

  sock.on('end', function() {
    console.log('disconnected');
  });

  console.log('connection from: ', sock.remoteAddress, ':', sock.remotePort);

}).listen(4444);
