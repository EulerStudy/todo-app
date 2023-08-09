// MongoDB, Bootstrap, EJS, JQuery, Ajax
const express = require('express')
const bodyParser = require('body-parser')
const dotenv = require('dotenv')
const methodOverride = require('method-override')

dotenv.config()
const app = express()
app.use('/public', express.static('public'))

// socket
const http = require('http').createServer(app)
const { Server } = require('socket.io')
const io = new Server(http)

// EJS
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(methodOverride('_method'))

// MongoDB 3.6.4
const MongoClient = require('mongodb').MongoClient
const objectId = require('mongodb').ObjectId

// session
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const session = require('express-session')

app.use(session({secret: 'secret', resave: true, saveUninitialized: false}))
app.use(passport.initialize())
app.use(passport.session())

// multer
const multer = require('multer')
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, './public/images')
  },
  filename: function(req, file, cb) {
    cb(null, file.originalname)
  },
  filefilter: function(req, file, cb) {
    // 여기 이미지 파일만 업로드 하세요    
  },
  limits: function(req, file, cb) {
    // 파일 사이즈 제한    
  },
})
const upload = multer({storage})

let db
MongoClient.connect(process.env.MONGO_URI, { useUnifiedTopology: true }, function(err, client) {
  if (err) {
    return console.error(err)
  }
  db = client.db('todoapp')
  http.listen(4000, function() {
    console.log('listening on 4000');
  })
})
    
app.post('/add', (req, res) => {
  // res.send('전송완료')
  const {title, date} = req.body 
  db.collection('counter').findOne({ name: '게시물갯수'}, function(err, result) {
    count = result.totalPost
    const saved = { _id:count+1, title, date, write:req.user._id }
    db.collection('post').insertOne(saved, function(err, result) {
      db.collection('counter').updateOne({name:'게시물갯수'},{$inc:{totalPost:1}},function(err, result){
        if (err) { return console.log(err) }
      })
      db.collection('post').find().toArray(function (err, result) {
        res.render('list.ejs', { posts: result})
      })
    })
  })
}) 

app.get('/pet', (req, res) => {
  res.send('펫용품 쇼핑할 수 있는 페이지 입니다')
})

app.get('/beauty', (req, res) => {
  res.send('뷰티용품 쇼핑할 수 있는 페이지 입니다')
})

app.get('/', (req, res) => {
  res.render('index.ejs')
})

app.get('/write', (req, res) => {
  // res.sendFile(__dirname + '/write.html')
  res.render('write.ejs')
})

app.get('/list', (req, res) => {
  db.collection('post').find().toArray(function (err, result) {
    res.render('list.ejs', { posts: result})
  })
})

app.delete('/delete', function (req, res) {
  req.body._id = parseInt(req.body._id)
  //console.log(req.body)
  const data = { _id: req.body._id, write: req.user._id}
  db.collection('post').deleteOne(data, function (err, result) {
    console.log('삭제완료')
    res.status(200).send({message: '성공했습니다.'})
  })
})

app.get('/detail/:id', function (req, res) {
  db.collection('post').findOne({_id: parseInt(req.params.id)}, function (err, result) {
    console.log(result)
    res.render('detail.ejs', { data: result } )
  })
})

app.get('/edit/:id', function (req, res) {
  db.collection('post').findOne({_id: parseInt(req.params.id)}, function (err, result) {
    res.render('edit.ejs', { post: result})
  })
})

app.put('/edit', function (req, res) {
  const { id, title, date } = req.body
  console.log(req.body)
  db.collection('post').updateOne({_id: parseInt(id)},{$set:{title, date}},function(err, result) {
    db.collection('post').find().toArray(function (err, result) {
      res.render('list.ejs', { posts: result})
    })
  })
})

app.get('/login', function (req, res) {
  res.render('login.ejs')
})

app.post('/login', passport.authenticate('local', {
  failureRedirect: '/fail'
}), function (req, res) {
  res.redirect('/')
})

passport.use(new LocalStrategy({
  usernameField: 'id',
  passwordField: 'pw',
  session: true,
  passReqToCallback: false,
}, function(id, pw, done) {
  console.log(id, pw)
  db.collection('login').findOne({id}, function(err, result) {
    if (err) return done(err)
    if (!result) return done(null, false, {message:'존재하지 않는 아이디요'})
    if (pw === result.pw) {
      return done(null, result)
    } else {
      return done(null, false, {message: '비번이 틀렸어요'})
    }
  })
}))

passport.serializeUser(function(user, done) {
  // console.log('aa', user.id)
  done(null, user.id)
})
passport.deserializeUser(function(id, done) {
  console.log('bb', id)
  db.collection('login').findOne({id}, function(err, result) {
    done(null, result)
  })
})

app.get('/mypage', isLogin, function(req, res) {
  // console.log(req.user)
  res.render('mypage.ejs', { user: req.user })
})

function isLogin(req, res, next) {
  // console.log('cc', req.user)
  if (req.user) {
    next()
  } else {
    res.send('로그인 안하셨는데요')
  }
}

app.get('/search', (req, res) => {
  const title = req.query.value
  console.log(title)
  
  // no indexing
  // db.collection('post').find({ title }).toArray((err, result) => {
  // indexing
  // db.collection('post').find({ $text: { $search: title }}).toArray((err, result) => {

  let search_condition = [
    {
      $search: {
        index: 'titleSearch',
        text: {
          query: req.query.value,
          path: "title",  // title, date 필드에서 찾고 싶으면 ['title', 'date']
        }
      }
    },
    {
      $sort: {
        _id: 1  // id 오름 차순
      }
    },
    {
      $limit: 10  // 제한 10개
    },
    {
      $project: { // 검색 결과로 무엇을 보여줄지, projector를 생각하라.
        title: 1, // title은 가져오고 _id는 안가져옴
        _id: 0,   // 아마 안써도 안겨져올 것 같음
        score:{ $meta: "searchScore"},  // 스코어도 가져오라고 함
      }
    }
  ]
  db.collection('post').aggregate(search_condition).toArray((err, result) => {
    console.log(result)
    res.render('search.ejs', { posts: result})
  })
})

app.post('/register', (req, res) => {
  db.collection('login').insertOne({ id: req.body.id, pw: req.body.pw }, (err, result) => {
    res.redirect('/')
  })
})

app.use('/shop', require('./routes/shop.js'))

app.get('/upload', (req, res) => {
  res.render('upload.ejs')
})

// app.post('/upload', upload.array('profile', 10), (req, res) => {     // 여러개의 파일, 한 번에 전송할 수 있는 파일 개수 
app.post('/upload', upload.single('profile'), (req, res) => {
  res.send('업로드 완료')
})

app.get('/image/:imageName', (req, res) => {
  res.sendFile(__dirname + '/public/images/' + req.params.imageName)
})

const { ObjectId } = require('mongodb');

app.post('/chatroom', isLogin, (req, res) => {
  console.log('a', req.body.hostId)
  console.log('b', req.user._id)

  let saveDate = {
    title: '무슨무슨채팅방',
    member: [objectId(req.body.hostId), req.user._id],
    date: new Date()
  }
  db.collection('chatroom').insertOne(saveDate).then(() => {})
})

app.get('/chat', isLogin, (req, res) => {
  db.collection('chatroom').find({ member: req.user._id }).toArray().then((result) => {
    res.render('chat.ejs', { data: result })
  })
})

app.post('/message', isLogin, function (req, res) {
  const saveData = {
    parent: req.body.parent,
    content:req.body.content,
    userid: req.user._id,
    date: new Date()
  }
  db.collection('message').insertOne(saveData).then(()=>{
    console.log('DB저장 성공')
  })
})

app.get('/message/:id', isLogin, (req, res) => {
  res.writeHead(200, {
    "Connection": "Keep-Alive",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  })
  db.collection('message').find({ parent: req.params.id}).toArray().then((result)=>{
    res.write('event: test\n')
    res.write('data: ' + JSON.stringify(result) + '\n\n')
  })

  const pipeline = [
    { $match: { 'fullDocument.parent' : req.params.id} }
  ]
  const collection = db.collection('message')
  const changeStream = collection.watch(pipeline)
  changeStream.on('change', (result) => {
    res.write('event: test\n')
    res.write('data: ' + JSON.stringify([result.fullDocument]) + '\n\n')
  })
})

app.get('/socket', (req, res) => {
  res.render('socket.ejs')
})

io.on('connection', function(socket) {
  console.log('유저접속됨')

  socket.on('user-send', (data) => {
    console.log(data)
    io.emit('broadcast', data)
    io.to(socket.id).emit('broadcast', data)  // 특정 소켓 id를 가진 사람에게만 전송
  })

  socket.on('joinroom', function(data) {
    socket.join('room1')
    console.log('room1에 입장하셨습니다')
  })

  socket.on('room1-send', function(data) {
    console.log(data)
    io.to('room1').emit('broadcast', data)  // room1에 접속한 사람들에게만 데이터 전송
  })
})