const express = require("express");
const csv = require("csv-parser");
const fs = require("fs");
const Sequelize = require("sequelize");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const e = require("express");

const app = express();
const sequelize = new Sequelize("mysql://root@localhost/delilahresto");

app.use(bodyParser.json());

//MIDDLEWARES

function productoExistente(req, res, next) {
  const productoNuevo = req.body;
  sequelize
    .query("SELECT * FROM Productos", { type: sequelize.QueryTypes.SELECT })
    .then(function (arrayProductos) {
      const productoRepetido = arrayProductos.find(
        (producto) => producto.Nombre === productoNuevo.nombre
      );
      if (!productoRepetido) {
        next();
      } else {
        res.status(400);
        res.send("Error, producto repetido");
      }
    });
}

function idExistente(req, res, next) {
  const id = req.params.idProducto;
  sequelize
    .query("SELECT * FROM productos", { type: sequelize.QueryTypes.SELECT })
    .then(function (resultado) {
      const idEncontrado = resultado.find((fila) => fila.ID == id);
      if (idEncontrado) {
        next();
      } else {
        res.status(404);
        res.send("Error, producto no encontrado");
      }
    });
}

function validarUsuarioContraseña(req, res, next) {
  const usuarioIngresado = req.body;
  sequelize
    .query("SELECT * FROM Usuarios", { type: sequelize.QueryTypes.SELECT })
    .then(function (arrayUsuarios) {
      const usuarioValidado = arrayUsuarios.find(
        (fila) =>
          fila.Usuario === usuarioIngresado.usuario &&
          fila.Contraseña === usuarioIngresado.contraseña
      );
      if (!usuarioValidado) {
        res.status(400);
        res.send("Error, usuario o contraseña incorrectos");
      } else {
        next();
      }
    });
}

function usuarioRepetido(req, res, next) {
  const usuario = req.body;
  sequelize
    .query("SELECT Usuario, Correo_electronico FROM Usuarios", {
      type: sequelize.QueryTypes.SELECT,
    })
    .then(function (arrayUsuarios) {
      const usuarioRepetido = arrayUsuarios.find(
        (fila) =>
          fila.Usuario === usuario.usuario ||
          fila.Correo_electronico === usuario.correo_electronico
      );
      if (usuarioRepetido) {
        res.status(400);
        res.send("Error, usuario ya existente");
      } else {
        next();
      }
    });
}

function esAdmin(req, res, next) {
  const token = req.headers.authorization.split(" ")[1];
  if (token) {
    const descodificado = jwt.verify(token, "1234");
    console.log(descodificado);
    sequelize
      .query(
        "SELECT Tipo_usuario FROM usuarios WHERE Usuario = ?",
        { replacements: [descodificado] },
        { type: sequelize.QueryTypes.SELECT }
      )
      .then(function (resultado) {
        if (resultado[0][0].Tipo_usuario === "admin") {
          next();
        } else {
          res.status(401);
          res.send("Acceso denegado");
        }
      });
  } else {
    res.send(
      "Error, solo usuarios administradores pueden acceder a esta pagina"
    );
  }
}

function verificarDatos(req, res, next) {
  const pedido = req.body;
  sequelize
    .query("SELECT * FROM productos", { type: sequelize.QueryTypes.SELECT })
    .then(function (resultado) {
      if (
        pedido.forma_de_pago != "Efectivo" &&
        pedido.forma_de_pago != "Tarjeta de credito" &&
        pedido.forma_de_pago != "Tarjeta de debito"
      ) {
        res.status(400);
        res.send("Error, forma de pago incorrecta");
      }
      if (!pedido.direccion) {
        res.status(400);
        res.send("Error, ingrese alguna direccion");
      } else {
        next();
      }
    });
}

function verificarProductos(req, res, next) {
  const pedido = req.body;
  sequelize
    .query("SELECT Nombre FROM productos", {
      type: sequelize.QueryTypes.SELECT,
    })
    .then(function (resultado) {
      function productoAVerificar(elemento) {
        const productoEncontrado = resultado.find(
          (fila) => fila.Nombre === elemento
        );
        if (productoEncontrado) {
          return true;
        }
      }

      const pedidoCorrecto = pedido.producto.every(productoAVerificar);

      if (pedidoCorrecto) {
        next();
      } else {
        res.status(404);
        res.send("Error, producto no encontrado");
      }
    });
}

function usuarioLogueado(req, res, next) {
  const token = req.headers.authorization.split(" ")[1];
  if (token) {
    const descodificado = jwt.verify(token, "1234");
    if (descodificado) {
      console.log(descodificado);
      next();
    }
  } else {
    res.status(401);
    res.send("Error, usuario debe estar logueado");
  }
}

function accesoAPedido(req, res, next) {
  const token = req.headers.authorization.split(" ")[1];
  const descodificado = jwt.verify(token, "1234");
  const id = req.params.idUsuario;

  sequelize
    .query("SELECT Usuario FROM usuarios WHERE ID = ?", { replacements: [id] })
    .then(function (resultado) {
      if (resultado[0][0].usuario === descodificado) {
        next();
      } else {
        sequelize
          .query(
            "SELECT Tipo_usuario FROM usuarios WHERE usuario = ?",
            { replacements: [descodificado] },
            { type: sequelize.QueryTypes.SELECT }
          )
          .then(function (resultado) {
            if (resultado[0][0].Tipo_usuario === "admin") {
              next();
            } else {
              res.status(401);
              res.send("Acceso denegado");
            }
          });
      }
    });
}

function tipoUsuario(req, res, next) {
  const tipoUsuario = req.body
  if (tipoUsuario.tipo_usuario == "user" || tipoUsuario.tipo_usuario == "admin") {
    console.log(tipoUsuario)
    next()
  } else {
    res.status(400)
    res.send("Error, tipo de usuario incorrecto")
  }
}

//ENDPOINTS

//PRODUCTOS

app.listen(3000, () => {
  console.log("Servidor iniciando");
});
app.get("/productos", usuarioLogueado, (req, res) => {
  sequelize
    .query("SELECT * FROM Productos", { type: sequelize.QueryTypes.SELECT })
    .then(function (resultado) {
      res.status(200);
      res.send(resultado);
    });
});

app.get("/productos/:idProducto", usuarioLogueado, idExistente, (req, res) => {
  const id = req.params.idProducto;
  sequelize
    .query(
      "SELECT * FROM Productos WHERE id = ?",
      { replacements: [id] },
      { type: sequelize.QueryTypes.SELECT }
    )
    .then(function (resultado) {
      res.status(200);
      res.send(resultado[0 ]
        );
    });
});

app.post("/productos", esAdmin, productoExistente, (req, res) => {
  const productoNuevo = req.body;
  sequelize
    .query("INSERT INTO Productos (ID, Nombre, Precio) VALUES (NULL, ?, ?)", {
      replacements: [productoNuevo.nombre, productoNuevo.precio],
    })
    .then(function (resultado) {
      res.status(201);
      res.send("Producto agregado exitosamente");
      console.log(resultado);
    });
});

app.put("/productos/:idProducto", esAdmin, productoExistente, (req, res) => {
  const id = req.params.idProducto;
  const { nombre, precio } = req.body;
  sequelize
    .query("UPDATE Productos SET nombre = ?, precio = ? WHERE id = ?", {
      replacements: [nombre, precio, id],
    })
    .then(function (resultado) {
      res.status(200);
      res.send("Producto actualizado");
    });
});

app.delete("/productos/:idProducto", esAdmin, idExistente, (req, res) => {
  const id = req.params.idProducto;
  sequelize
    .query("DELETE FROM Productos WHERE id = ?", { replacements: [id] })
    .then(function (resultado) {
      res.status(200);
      res.send("Producto eliminado");
    });
});

//USUARIOS

app.post("/join", usuarioRepetido, (req, res) => {
  const usuario = req.body;
  sequelize
    .query(
      "INSERT INTO usuarios (ID, Usuario, Nombre_y_apellido, Correo_electronico, Telefono, Direccion_de_envio, Contraseña) VALUES (NULL, ?, ?, ?, ?, ?, ?)",
      {
        replacements: [
          usuario.usuario,
          usuario.nombre_y_apellido,
          usuario.correo_electronico,
          usuario.telefono,
          usuario.direccion,
          usuario.contraseña,
        ],
      }
    )
    .then(function (resultado) {
      res.status(201);
      res.send("Usuario creado exitosamente");
    });
});

app.post("/login", validarUsuarioContraseña, (req, res) => {
  const usuario = req.body;
  const token = jwt.sign(usuario.usuario, "1234");
  res.status(200);
  res.send(
    "Bienvenido" + " " + usuario.usuario + " " + "-->" + " " + token
  );
});

app.put("/tipo_usuario/:idUsuario", esAdmin, tipoUsuario, (req, res)=>{
  const idUsuario = req.params.idUsuario
  const tipoUsuario = req.body
  sequelize.query("UPDATE usuarios SET Tipo_usuario = ? WHERE ID = ?", {replacements:[tipoUsuario.tipo_usuario, idUsuario]})
  .then(function(){
    res.status(200)
    res.send("Tipo de usuario modificado exitosamente")
  })
})

//PEDIDOS

app.post(
  "/pedidos",
  usuarioLogueado,
  verificarProductos,
  verificarDatos,
  (req, res) => {
    const pedido = req.body;
    const arrayProductos = pedido.producto
    const token = req.headers.authorization.split(" ")[1];
    const descodificado = jwt.verify(token, "1234");
    const arrayProductosToString = arrayProductos.toString();
    console.log(arrayProductosToString)
    sequelize
      .query(
        "SELECT ID FROM usuarios WHERE Usuario = ?",
        { replacements: [descodificado] },
        { type: sequelize.QueryTypes.SELECT }
      )
      .then(function (resultado) {
        sequelize
          .query(
            "INSERT INTO pedidos (ID, Detalle, Forma_de_pago, Direccion, Estado, ID_usuario) VALUES (NULL, ?, ?, ?, ?, ?)",
            {
              replacements: [
                arrayProductosToString,
                pedido.forma_de_pago,
                pedido.direccion,
                "Nuevo",
                resultado[0][0].ID,
              ],
            }
          )
          .then(function (resultado) {
            res.status(201);
            res.send("Pedido ingresado" + " " + descodificado);
          });
      });
    sequelize
      .query("SELECT ID FROM pedidos", { type: sequelize.QueryTypes.SELECT })
      .then(function (resultado) {
        const idPedido = resultado[resultado.length - 1];
        const productosPedido = pedido.producto;
        productosPedido.forEach((element) => {
          sequelize
            .query("SELECT ID FROM productos WHERE Nombre = ?", {
              replacements: [element],
            })
            .then(function (resultado) {
              sequelize
                .query(
                  "INSERT INTO pedidos_productos (pedido_ID, productos_ID) VALUES (?,?)",
                  { replacements: [idPedido.ID + 1, resultado[0][0].ID] }
                )
                .then(function () {
                  console.log("Tabla pedidos_productos actualizada");
                });
            });
          const productosPedido = pedido.producto;
          const arrayPrecios = [];
          const reducer = (acc, cur) => acc + cur;
          productosPedido.forEach((element) => {
            sequelize
              .query(
                "SELECT Precio FROM productos WHERE Nombre = ?",
                { replacements: [element] },
                { type: sequelize.QueryTypes.SELECT }
              )
              .then(function (resultado) {
                arrayPrecios.push(resultado[0][0].Precio);
                const total = arrayPrecios.reduce(reducer);
                sequelize
                  .query("UPDATE pedidos SET Total = ? WHERE ID = ?", {
                    replacements: [total, idPedido.ID + 1],
                  })
                  .then(function (resultado) {
                    console.log("Tabla pedidos actualizada");
                  });
              });
          });
        });
      });
  }
);

app.get("/pedidos/:idUsuario", accesoAPedido, (req, res) => {
  const id = req.params.idUsuario;
  sequelize
    .query(
      "SELECT * FROM pedidos WHERE ID_usuario = ?",
      { replacements: [id] },
      { type: sequelize.QueryTypes.SELECT }
    )
    .then(function (resultado) {
      if (resultado[0].length > 0) {
        res.status(200);
        res.send(resultado[0]);
      } else {
        res.status(204);
        res.send("El usuario no ha realizado ningun pedido");
      }
    });
});

app.put("/pedidos/estado/:idPedido", esAdmin, (req, res) => {
  const id = req.params.idPedido;
  const { estado } = req.body;
  sequelize
    .query("UPDATE pedidos SET Estado = ? WHERE ID = ?", {
      replacements: [estado, id],
    })
    .then(function (resultado) {
      res.status(200);
      res.send("Pedido actualizado exitosamente");
    });
});

app.put("/pedidos/:idPedido", esAdmin, (req, res) => {
  const id = req.params.idPedido;
  const { detalle, total, forma_de_pago, direccion } = req.body;
  const arrayDetalleToString = detalle.toString();
  sequelize
    .query(
      "UPDATE pedidos SET Detalle = ?, Total = ?, Forma_de_pago = ?, Direccion = ? WHERE ID = ?",
      { replacements: [arrayDetalleToString, total, forma_de_pago, direccion, id] }
    )
    .then(function (resultado) {
      res.status(200);
      res.send("Pedido actualizado exitosamente");
    });
});

app.delete("/pedidos/:idPedido", esAdmin, (req, res) => {
  const id = req.params.idPedido;
  sequelize
    .query("DELETE FROM Pedidos WHERE id = ?", { replacements: [id] })
    .then(function (resultado) {
      res.status(200);
      res.send("Pedido eliminado exitosamente");
    });
});

app.get("/pedidos", esAdmin, (req, res) => {
  sequelize
    .query("SELECT pedidos.ID, pedidos.Detalle, pedidos.Total, pedidos.Forma_de_pago, usuarios.Usuario, pedidos.Direccion FROM usuarios JOIN pedidos ON usuarios.ID = pedidos.ID_usuario", { type: sequelize.QueryTypes.SELECT })
    .then(function (resultado) {
      res.status(200);
      res.json(resultado);
    });
});

app.get("/pedidos/id/:idPedido", esAdmin, (req, res)=>{
  const idPedido = req.params.idPedido;
    sequelize.query("SELECT productos.*, pedidos.ID_usuario  FROM productos JOIN pedidos_productos ON productos.ID = pedidos_productos.productos_ID JOIN pedidos ON pedidos.ID = pedidos_productos.pedido_ID WHERE pedidos.ID = ?",{replacements:[idPedido]}, { type: sequelize.QueryTypes.SELECT })
    .then(function(resultado){
      res.status(200)
      res.json(resultado[0])
    })
  })