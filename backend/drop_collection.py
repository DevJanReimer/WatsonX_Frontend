# run this once in a python shell or save as drop_collections.py
from astrapy import DataAPIClient
from dotenv import load_dotenv
import os

load_dotenv()
client = DataAPIClient(os.environ["ASTRA_DB_APPLICATION_TOKEN"])
db = client.get_database(os.environ["ASTRA_DB_API_ENDPOINT"])

db.drop_collection("isdp_tables")
db.drop_collection("isdp_images")
db.drop_collection("isdp_chunks")
print("Done")