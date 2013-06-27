"use strict";

var net = require('net')
  , _   = require('underscore')
  , jParser = require('jParser')
  // ^ This also defines jDataView...
;


function Cursor(data) {
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
        var offs = this.current.offsets
          , out = new Array(offs.length - 1);

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
    }
  });

  var payload = parser.parse('packet')
    , h  = payload.header
    , cs = payload.chunks

    , recordCount = h.recordCount
    , fieldCount  = h.fieldCount
    , metaCount   = h.metaCount

    , mpos = fieldCount * (1 + recordCount)

    , fields      = cs.slice(0, fieldCount)
    , fieldIndex  = _.object(fields, _.range(fieldCount))
  ;

  this.meta = _.object(cs.slice(mpos, mpos+metaCount),
                       cs.slice(mpos+metaCount, mpos+2*metaCount));

  this.fields = fields;
  this.fieldCount  = fieldCount;
  this.recordCount = recordCount;

  this.record = function(i) {
    if (i >= recordCount)
      return null;
    var s = (i + 1) * fieldCount;
    return _.object(fields, cs.slice(s, s + fieldCount));
  };
  this.value = function(i, field) {
    if (i >= recordCount)
      return null;
    var p = (i + 1) * fieldCount + fieldIndex[field];
    return cs[p];
  };
}

var server = net.createServer(function(sock) {
  sock.on('data', function(data) {
    console.log('received ', data.length, ' bytes');

    var curs = new Cursor(data)
      , rec
      , i = 0;
    while ((rec = curs.record(i++))) {
      console.log('rec:',rec);
    }

    i = 0;
    while (i < curs.recordCount) {
      console.log(curs.value(i, 'name'), curs.value(i, 'age'));
      i++;
    }

  });

  sock.on('end', function() {
    console.log('disconnected');
  });

  console.log('connection from: ', sock.remoteAddress, ':', sock.remotePort);

}).listen(4444);
