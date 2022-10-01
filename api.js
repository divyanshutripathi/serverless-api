const db = require("./db");
const {
  draftStatus,
  completeStatus,
  assignedStatus,
  inprogressStatus,
  closeStatus,
  regexForTitle,
  managerRole,
  memberRole,
  leadRole,
} = require("./config/const");
const { v4: uuidv4 } = require("uuid");
const {
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  ScanCommand,
  UpdateItemCommand,
} = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

const checkUser = async (userId) => {
  const response = { statusCode: 200 };

  try {
    const params = {
      TableName: process.env.DYNAMODB_USER_TABLE_NAME,
      Key: marshall({ userId: userId }),
    };
    const { Item } = await db.send(new GetItemCommand(params));

    console.log({ Item });
    return {
      message: "Successfully retrieved User.",
      data: Item ? unmarshall(Item) : {},
      rawData: Item,
    };
  } catch (e) {
    console.error(e);
    //   response.statusCode = 500;
    console.log({
      message: "Failed to get Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  // return response;
};

const getTask = async (event) => {
  const response = { statusCode: 200 };

  try {
    const params = {
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Key: marshall({ taskId: event.pathParameters.taskId }),
    };
    const { Item } = await db.send(new GetItemCommand(params));

    console.log({ Item });
    response.body = JSON.stringify({
      message: "Successfully retrieved Task.",
      data: Item ? unmarshall(Item) : {},
      rawData: Item,
    });
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to get Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};

const createTask = async (event) => {
  const response = { statusCode: 200 };

  try {
    const taskId = uuidv4();
    const body = JSON.parse(event.body);
    const user = await checkUser(body.userId);
    console.log("user : ", user);
    if (
      user &&
      (user.data.userRole.toLowerCase() === leadRole.toLowerCase() ||
        user.data.userRole.toLowerCase() === managerRole.toLowerCase())
    ) {
      if (
        regexForTitle.test(body.title) &&
        body.title.length > 3 &&
        body.title.length < 30
      ) {
        const query = {
          taskId,
          title: body.title,
          description: body.description | null,
          dateCreated: Date.now(),
          dateStarted: null,
          dateAssigned: null,
          dateCompleted: null,
          dateClosed: null,
          status: draftStatus,
          createdBy: body.userId,
          assignedTo: null,
        };

        const params = {
          TableName: process.env.DYNAMODB_TABLE_NAME,
          Item: marshall(query || {}),
        };
        const createResult = await db.send(new PutItemCommand(params));

        response.body = JSON.stringify({
          message: "Successfully created Task.",
          createResult,
        });
      } else {
        response.body = JSON.stringify({
          message:
            "Title should have only # and _ as special character, should be >3 and <30 characters.",
        });
      }
    } else {
      if (user) {
        response.body = JSON.stringify({
          message: "User does not have the Authority",
        });
      } else {
        response.body = JSON.stringify({
          message: "User not found",
        });
      }
    }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to create Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};

const createUser = async (event) => {
  const response = { statusCode: 200 };

  try {
    const userId = uuidv4();
    const body = JSON.parse(event.body);
    let userRole = body.userRole;
    //   const user = checkUser(body.email);
    //   if (
    //     user &&
    //     (user.data.userRole.toLowerCase() === leadRole.toLowerCase() ||
    //       user.data.userRole.toLowerCase() === managerRole.toLowerCase())
    //   ) {
    // if (body.title.test(regexForTitle) && body.title > 3 && body.title < 30) {
    const query = {
      userId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      dateCreated: Date.now(),
      userRole,
    };

    const params = {
      TableName: process.env.DYNAMODB_USER_TABLE_NAME,
      Item: marshall(query || {}),
    };
    const createResult = await db.send(new PutItemCommand(params));

    response.body = JSON.stringify({
      message: "Successfully created User.",
      createResult,
    });
    //     } else {
    //       response.body = JSON.stringify({
    //         message:
    //           "Title should have only # and _ as special character, should be >3 and <30 characters.",
    //       });
    //     }
    //   } else {
    //     if (user) {
    //       response.body = JSON.stringify({
    //         message: "User does not have the Authority",
    //       });
    //     } else {
    //       response.body = JSON.stringify({
    //         message: "User not found",
    //       });
    //     }
    //   }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to create User.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};

const updateTaskCommon = async (query, taskId) => {
  let res = { statusCode: 200 };
  try {
    if (
      (query.title &&
        query.title.test(regexForTitle) &&
        query.title > 3 &&
        query.title < 30) ||
      !query.title
    ) {
      let objKeys = Object.keys(query);
      let params = {
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Key: marshall({ taskId }),
        UpdateExpression: `SET ${objKeys
          .map((_, index) => `#key${index} = :value${index}`)
          .join(", ")}`,
        ExpressionAttributeNames: objKeys.reduce(
          (acc, key, index) => ({
            ...acc,
            [`#key${index}`]: key,
          }),
          {}
        ),
        ExpressionAttributeValues: marshall(
          objKeys.reduce(
            (acc, key, index) => ({
              ...acc,
              [`:value${index}`]: query[key],
            }),
            {}
          )
        ),
      };
      const updateResult = await db.send(new UpdateItemCommand(params));

      res.body = JSON.stringify({
        message:
          `Successfully` + query.status ? query.status : "updated" + `Task.`,
        updateResult,
      });
    } else {
      res.body = JSON.stringify({
        message:
          "Title should have only # and _ as special character, should be >3 and <30 characters.",
      });
    }
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.body = JSON.stringify({
      message: "Failed to update Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return res;
};

const updateTask = async (event) => {
  let response = { statusCode: 200 };

  try {
    const user = await checkUser(body.userId);
    if (user) {
      const body = JSON.parse(event.body);
      if (body.title || body.description) {
        const query = {
          title: body.title,
          description: body.description,
        };
        const taskId = event.pathParameters.taskId;
        response = { ...(await updateTaskCommon(query, taskId)) };
      } else {
        response.body = JSON.stringify({
          message: "wrong query",
        });
      }
    } else {
      response.body = JSON.stringify({
        message: "User not found",
      });
    }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to update Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};

const deleteTask = async (event) => {
  const response = { statusCode: 200 };

  try {
    const user = await checkUser(body.userId);
    if (
      user &&
      (user.data.userRole.toLowerCase() === leadRole.toLowerCase() ||
        user.data.userRole.toLowerCase() === managerRole.toLowerCase())
    ) {
      const params = {
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Key: marshall({ taskId: event.pathParameters.taskId }),
      };
      const deleteResult = await db.send(new DeleteItemCommand(params));

      response.body = JSON.stringify({
        message: "Successfully deleted Task.",
        deleteResult,
      });
    } else {
      if (user) {
        response.body = JSON.stringify({
          message: "User does not have the Authority",
        });
      } else {
        response.body = JSON.stringify({
          message: "User not found",
        });
      }
    }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to delete Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};

const getAllTasksForAUser = async (event) => {
  const response = { statusCode: 200 };

  try {
    const user = await checkUser(event.pathParameters.userId);
    if (user) {
      const params = {
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Key: marshall({ assignedTo: event.pathParameters.userId }),
      };
      const { Items } = await db.send(new GetItemCommand(params));

      console.log({ Items });
      response.body = JSON.stringify({
        message: "Successfully retrieved Task.",
        data: Items ? unmarshall(Items) : {},
        rawData: Items,
      });
    } else {
      response.body = JSON.stringify({
        message: "User not found",
      });
    }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to retrieve Tasks.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};
//TO DO
const assignTaskToAUser = async (event) => {
  let response = { statusCode: 200 };

  try {
    let body = JSON.parse(event.body);
    const user1 = await checkUser(body.userId);
    const user2 = await checkUser(event.pathParameters.userId);
    if (
      user1 &&
      (user1.data.userRole.toLowerCase() === leadRole.toLowerCase() ||
        user1.data.userRole.toLowerCase() === managerRole.toLowerCase())
    ) {
      if (user2) {
        const query = {
          dateAssigned: Date.now(),
          status: assignedStatus,
          assignedTo: event.pathParameters.userId,
        };

        const taskId = event.pathParameters.taskId;
        response = { ...(await updateTaskCommon(query, taskId)) };
      } else {
        response.body = JSON.stringify({
          message: "member does not exist",
        });
      }
    } else {
      response.body = JSON.stringify({
        message: "User not found.",
      });
    }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to update Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};
// TO DO
const updateTaskToInprogress = async (event) => {
  let response = { statusCode: 200 };

  try {
    const body = JSON.parse(event.body);
    const user = await checkUser(body.userId);
    if (user) {
      const query = {
        dateStarted: Date.now(),
        status: inprogressStatus,
      };
      const taskId = event.pathParameters.taskId;
      response = { ...(await updateTaskCommon(query, taskId)) };
    } else {
      response.body = JSON.stringify({
        message: "User not found.",
      });
    }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to update Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};

const updateTaskToComplete = async (event) => {
  let response = { statusCode: 200 };

  try {
    const body = JSON.parse(event.body);
    const user = await checkUser(body.userId);
    if (user) {
      const query = {
        dateCompleted: Date.now(),
        status: completeStatus,
      };
      const taskId = event.pathParameters.taskId;
      response = { ...(await updateTaskCommon(query, taskId)) };
    } else {
      response.body = JSON.stringify({
        message: "User not found.",
      });
    }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to update Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};

const updateTaskToClose = async (event) => {
  let response = { statusCode: 200 };

  try {
    const body = JSON.parse(event.body);
    const user = await checkUser(body.userId);
    if (
      user &&
      (user.data.userRole.toLowerCase() === leadRole.toLowerCase() ||
        user.data.userRole.toLowerCase() === managerRole.toLowerCase())
    ) {
      const query = {
        dateClosed: Date.now(),
        status: closeStatus,
      };
      const taskId = event.pathParameters.taskId;
      response = { ...(await updateTaskCommon(query, taskId)) };
    } else {
      if (user) {
        response.body = JSON.stringify({
          message: "User does not have the Authority",
        });
      } else {
        response.body = JSON.stringify({
          message: "User not found",
        });
      }
    }
  } catch (e) {
    console.error(e);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Failed to update Task.",
      errorMsg: e.message,
      errorStack: e.stack,
    });
  }

  return response;
};
module.exports = {
  getTask,
  createTask,
  updateTask,
  deleteTask,
  getAllTasksForAUser,
  assignTaskToAUser,
  updateTaskToInprogress,
  updateTaskToComplete,
  updateTaskToClose,
  createUser,
};
