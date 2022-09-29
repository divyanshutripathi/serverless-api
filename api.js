const db = require("./db");
const {
  draftStatus,
  completeStatus,
  assignedStatus,
  inprogressStatus,
  closeStatus,
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
    if (checkUser(body.userId)) {
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
        message: "User not found.",
      });
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

const updateTaskCommon = async (body) => {
  const res = { statusCode: 200 };
  try {
    const objKeys = Object.keys(body);
    const params = {
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Key: marshall({ taskId: body.taskId }),
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
            [`:value${index}`]: body[key],
          }),
          {}
        )
      ),
    };
    const updateResult = await db.send(new UpdateItemCommand(params));

    res.body = JSON.stringify({
      message: "Successfully updated Task.",
      updateResult,
    });
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
    const body = JSON.parse(event.body);
    if (body.title || body.description) {
      body.taskId = event.pathParameters.taskId;
      response = { ...updateTaskCommon(body) };
    } else {
      response.body = JSON.stringify({
        message: "wrong query",
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
    const params = {
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Key: marshall({ taskId: event.pathParameters.taskId }),
    };
    const deleteResult = await db.send(new DeleteItemCommand(params));

    response.body = JSON.stringify({
      message: "Successfully deleted Task.",
      deleteResult,
    });
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
    const params = {
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Key: marshall({ userId: event.pathParameters.userId }),
    };
    if (checkUser(event.pathParameters.userId)) {
      const { Items } = await db.send(new GetItemCommand(params));

      console.log({ Items });
      response.body = JSON.stringify({
        message: "Successfully retrieved Task.",
        data: Items ? unmarshall(Items) : {},
        rawData: Items,
      });
    } else {
      response.body = JSON.stringify({
        message: "User not found.",
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
  const response = { statusCode: 200 };

  try {
    const body = JSON.parse(event.body);
    if (checkUser(event.pathParameters.userId)) {
      if (body.assignedTo) {
        body.taskId = event.pathParameters.taskId;
        body.dateAssigned = Date.now();
        body.assignedTo = response = { ...(await updateTaskCommon(body)) };
      } else {
        response.body = JSON.stringify({
          message: "wrong query",
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
  const response = { statusCode: 200 };

  try {
    const body = JSON.parse(event.body);
    if (checkUser(event.pathParameters.userId)) {
      if (body.status.toLowerCase() === inprogressStatus.toLowerCase()) {
        body.taskId = event.pathParameters.taskId;
        body.dateStarted = Date.now();
        response = { ...(await updateTaskCommon(body)) };
      } else {
        response.body = JSON.stringify({
          message: "wrong query",
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

const updateTaskToComplete = async (event) => {
  const response = { statusCode: 200 };

  try {
    const body = JSON.parse(event.body);
    if (checkUser(event.pathParameters.userId)) {
      if (body.status.toLowerCase() === completeStatus.toLowerCase()) {
        body.taskId = event.pathParameters.taskId;
        body.dateCompleted = Date.now();
        response = { ...(await updateTaskCommon(body)) };
      } else {
        response.body = JSON.stringify({
          message: "wrong query",
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

const updateTaskToClose = async (event) => {
  const response = { statusCode: 200 };

  try {
    const body = JSON.parse(event.body);
    if (checkUser(event.pathParameters.userId)) {
      if (body.status.toLowerCase() === closeStatus.toLowerCase()) {
        body.taskId = event.pathParameters.taskId;
        body.dateClosed = Date.now();
        response = { ...(await updateTaskCommon(body)) };
      } else {
        response.body = JSON.stringify({
          message: "wrong query",
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
};
