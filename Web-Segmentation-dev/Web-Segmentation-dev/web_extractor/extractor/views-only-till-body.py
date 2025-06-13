import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status


def get_relative_xpath(element):
    """
    Generate a relative XPath for the given element.
    """
    print("Inside Get Relative Path")
    tag_name = element.tag_name

    # Use ID if available (unique identifier)
    id_attr = element.get_attribute("id")
    if id_attr:
        return f"//{tag_name}[@id='{id_attr}']"

    # Use name if available (common for form elements)
    name_attr = element.get_attribute("name")
    if name_attr:
        return f"//{tag_name}[@name='{name_attr}']"

    # Use class if available (but only if it's unique)
    class_attr = element.get_attribute("class")
    if class_attr:
        # Check if the class is unique
        siblings = element.find_elements(By.XPATH, f"//{tag_name}[@class='{class_attr}']")
        if len(siblings) == 1:
            return f"//{tag_name}[@class='{class_attr}']"

    # Use other attributes (e.g., type, value, etc.)
    attributes = element.get_property("attributes")
    conditions = []
    for attr in attributes:
        if attr["name"] not in ["id", "class", "style", "hidden"]:
            conditions.append(f"@{attr['name']}='{attr['value']}'")

    # If no unique attributes, use position in the DOM
    if not conditions:
        parent = element.find_element(By.XPATH, "..")
        siblings = parent.find_elements(By.XPATH, f"./{tag_name}")
        if len(siblings) > 1:
            index = siblings.index(element) + 1
            return f"{get_relative_xpath(parent)}/{tag_name}[{index}]"

    condition_str = " and ".join(conditions)
    return f"//{tag_name}[{condition_str}]" if conditions else f"//{tag_name}"


class ExtractDataView(APIView):
    def post(self, request):
        print("Inside views1.py")
        html_content = request.data.get("html")

        if not html_content:
            return Response({"error": "No HTML received"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Step 1: Set up Selenium WebDriver
            options = webdriver.ChromeOptions()
            options.add_argument("--headless")  
            driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)

            # Step 2: Load the HTML content into Selenium
            print("Loading HTML content into Selenium...")
            driver.get("data:text/html;charset=utf-8," + html_content)
            html_output_path = "html_content.txt"
            with open(html_output_path, "w", encoding="utf-8") as f:
                f.write(driver.page_source)

            print(f"HTML content saved to {html_output_path}")

            # Step 3: Wait for content to load (if applicable)
            try:
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.XPATH, "//*"))  # Wait for all elements to load
                )
            except Exception as e:
                print(f"Timeout waiting for content: {e}")

            # Step 4: Extract information for all elements
            elements = driver.find_elements(By.XPATH, "//*")
            print(f"Number of elements found: {len(elements)}")

            data = []
            for elem in elements:
                try:
                    if elem.is_displayed():  # Process only visible elements
                        relative_xpath = get_relative_xpath(elem)
                        x = elem.location.get("x", None)
                        y = elem.location.get("y", None)
                        width = elem.size.get("width", None)
                        height = elem.size.get("height", None)
                        bg_color = elem.value_of_css_property("background-color") or "N/A"
                        font_size = elem.value_of_css_property("font-size") or "N/A"
                        font_style = elem.value_of_css_property("font-style") or "N/A"
                        font_color = elem.value_of_css_property("color") or "N/A"
                        text = elem.text.strip()

                        data.append({
                            "Relative XPath": relative_xpath,
                            "x": x,
                            "y": y,
                            "width": width,
                            "height": height,
                            "background-color": bg_color,
                            "font-size": font_size,
                            "font-style": font_style,
                            "font-color": font_color,
                            "text": text,
                        })
                except Exception as e:
                    print(f"Error processing element: {e}")

            # Save data to a DataFrame
            if data:
                df = pd.DataFrame(data)
                print(df)
                df.to_csv("extracted_elements.csv", index=False)
                print("Data saved to extracted_elements.csv")
            else:
                print("No data to save.")

            # Quit the driver
            driver.quit()

            return Response({"message": "Elements extracted successfully", "rows": len(df)}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# -----------------------------------------

# import uuid
# import pandas as pd
# from selenium import webdriver
# from selenium.webdriver.common.by import By
# from selenium.webdriver.support.ui import WebDriverWait
# from selenium.webdriver.support import expected_conditions as EC
# from selenium.webdriver.chrome.service import Service as ChromeService
# from webdriver_manager.chrome import ChromeDriverManager
# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
# from contextlib import contextmanager

# def get_relative_xpath(element):
#     """
#     Generate a relative XPath for the given element.
#     """
#     print("Inside Get Relative Path")
#     tag_name = element.tag_name

#     # Use ID if available (unique identifier)
#     id_attr = element.get_attribute("id")
#     if id_attr:
#         return f"//{tag_name}[@id='{id_attr}']"

#     # Use name if available (common for form elements)
#     name_attr = element.get_attribute("name")
#     if name_attr:
#         return f"//{tag_name}[@name='{name_attr}']"

#     # Use class if available (but only if it's unique)
#     class_attr = element.get_attribute("class")
#     if class_attr:
#         # Check if the class is unique
#         siblings = element.find_elements(By.XPATH, f"//{tag_name}[@class='{class_attr}']")
#         if len(siblings) == 1:
#             return f"//{tag_name}[@class='{class_attr}']"

#     # Use other attributes (e.g., type, value, etc.)
#     attributes = element.get_property("attributes")
#     conditions = []
#     for attr in attributes:
#         if attr["name"] not in ["id", "class", "style", "hidden"]:
#             conditions.append(f"@{attr['name']}='{attr['value']}'")

#     # If no unique attributes, use position in the DOM
#     if not conditions:
#         parent = element.find_element(By.XPATH, "..")
#         siblings = parent.find_elements(By.XPATH, f"./{tag_name}")
#         if len(siblings) > 1:
#             index = siblings.index(element) + 1
#             return f"{get_relative_xpath(parent)}/{tag_name}[{index}]"

#     condition_str = " and ".join(conditions)
#     return f"//{tag_name}[{condition_str}]" if conditions else f"//{tag_name}"

# def is_visible(element):
#     """
#     Check if an element is visible on the page.
#     """
#     print("Inside is_visible")
#     return element.is_displayed() and element.size["width"] > 0 and element.size["height"] > 0

# @contextmanager
# def get_driver():
#     """
#     Context manager for managing the Selenium WebDriver instance.
#     """
#     options = webdriver.ChromeOptions()
#     options.add_argument("--headless")  # Disable headless mode for debugging
#     driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)

#     try:
#         yield driver
#     finally:
#         driver.quit()

# class ExtractDataView(APIView):
#     def post(self, request):
#         print("Inside Post")
#         html_content = request.data.get("html")

#         if not html_content:
#             return Response({"error": "No HTML received"}, status=status.HTTP_400_BAD_REQUEST)

#         try:
#             with get_driver() as driver:
#                 print("Inside driver")
#                 # Load the HTML content into Selenium
#                 driver.get("data:text/html;charset=utf-8," + html_content)
#                 print(html_content)

#                 body = driver.find_element(By.TAG_NAME, "body")
#                 body_content = body.get_attribute("innerHTML")
#                 print("Body Content after waiting:")
#                 print(body_content)
                
#                 # Wait for content to load (if applicable)
#                 try:
#                     WebDriverWait(driver, 20).until(  # Increased timeout to 20 seconds
#                         EC.presence_of_element_located((By.XPATH, "//*"))
#                     )
#                 except Exception as e:
#                     print(f"Timeout waiting for content: {e}")

#                 # Print all elements in the DOM for debugging
#                 all_elements = driver.find_elements(By.XPATH, "/html/body//*")
#                 print("Total elements found:", len(all_elements))
#                 for elem in all_elements:
#                     print(elem.tag_name, elem.get_attribute("id"), elem.get_attribute("class"))
#                 # all_elements = driver.find_elements(By.XPATH, "//*")
#                 # for elem in all_elements:
#                 #     print(f"Tag: {elem.tag_name}, Text: '{elem.text.strip()}', Visible: {elem.is_displayed()}")


#                 # Define relevant tags for user-visible elements
#                 RELEVANT_TAGS = [
#                     "button", "input", "textarea", "select", "label",
#                     "p", "span", "div", "h1", "h2", "h3", "h4", "h5", "h6", "a", "img"
#                 ]

#                 # Find all relevant elements
#                 elements = []
#                 for tag in RELEVANT_TAGS:
#                     elements.extend(driver.find_elements(By.TAG_NAME, tag))
#                 print("Relevant elements found:", len(elements))

#                 # Extract data for visible elements
#                 data = []
#                 for elem in elements:
#                     if is_visible(elem):
#                         try:
#                             data.append({
#                                 "Relative XPath": get_relative_xpath(elem),
#                                 "x": elem.location["x"],
#                                 "y": elem.location["y"],
#                                 "width": elem.size["width"],
#                                 "height": elem.size["height"],
#                                 "background-color": elem.value_of_css_property("background-color"),
#                                 "font-size": elem.value_of_css_property("font-size"),
#                                 "font-style": elem.value_of_css_property("font-style"),
#                                 "font-color": elem.value_of_css_property("color"),
#                                 "text": elem.text.strip(),
#                             })
#                         except Exception as e:
#                             print(f"Error processing element: {e}")

#                 # Save data to a DataFrame
#                 df = pd.DataFrame(data)
#                 print(df)

#                 # Save to CSV
#                 # file_path = f"extracted_elements_{uuid.uuid4().hex}.csv"
#                 # df.to_csv(file_path, index=False)
#                 # print(f"Data saved to {file_path}")

#                 return Response({"message": "Elements extracted successfully", "rows": len(df)}, status=status.HTTP_200_OK)

#         except Exception as e:
#             return Response({"error": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# import uuid
# import pandas as pd
# from selenium import webdriver
# from selenium.webdriver.common.by import By
# from selenium.webdriver.support.ui import WebDriverWait
# from selenium.webdriver.support import expected_conditions as EC
# from selenium.webdriver.chrome.service import Service as ChromeService
# from webdriver_manager.chrome import ChromeDriverManager
# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
# from contextlib import contextmanager  # Import the contextmanager decorator

# def get_relative_xpath(element):
#     """
#     Generate a relative XPath for the given element.
#     """
#     print("Inside Get Relative Path")
#     tag_name = element.tag_name

#     # Use ID if available (unique identifier)
#     id_attr = element.get_attribute("id")
#     if id_attr:
#         return f"//{tag_name}[@id='{id_attr}']"

#     # Use name if available (common for form elements)
#     name_attr = element.get_attribute("name")
#     if name_attr:
#         return f"//{tag_name}[@name='{name_attr}']"

#     # Use class if available (but only if it's unique)
#     class_attr = element.get_attribute("class")
#     if class_attr:
#         # Check if the class is unique
#         siblings = element.find_elements(By.XPATH, f"//{tag_name}[@class='{class_attr}']")
#         if len(siblings) == 1:
#             return f"//{tag_name}[@class='{class_attr}']"

#     # Use other attributes (e.g., type, value, etc.)
#     attributes = element.get_property("attributes")
#     conditions = []
#     for attr in attributes:
#         if attr["name"] not in ["id", "class", "style", "hidden"]:
#             conditions.append(f"@{attr['name']}='{attr['value']}'")

#     # If no unique attributes, use position in the DOM
#     if not conditions:
#         parent = element.find_element(By.XPATH, "..")
#         siblings = parent.find_elements(By.XPATH, f"./{tag_name}")
#         if len(siblings) > 1:
#             index = siblings.index(element) + 1
#             return f"{get_relative_xpath(parent)}/{tag_name}[{index}]"

#     condition_str = " and ".join(conditions)
#     return f"//{tag_name}[{condition_str}]" if conditions else f"//{tag_name}"

# def is_visible(element):
#     """
#     Check if an element is visible on the page.
#     """
#     print("Inside is_visible")

#     return element.is_displayed() and element.size["width"] > 0 and element.size["height"] > 0

# @contextmanager
# def get_driver():
#     """
#     Context manager for managing the Selenium WebDriver instance.
#     """
#     options = webdriver.ChromeOptions()
#     options.add_argument("--headless")
#     options.add_argument("--enable-javascript")

#     driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)
#     try:
#         yield driver
#     finally:
#         driver.quit()

# class ExtractDataView(APIView):
#     def post(self, request):
#         print("inside Post")
#         html_content = request.data.get("html")

#         if not html_content:
#             return Response({"error": "No HTML received"}, status=status.HTTP_400_BAD_REQUEST)

#         try:
#             with get_driver() as driver:
#                 print("Insude driver")
#                 # Load the HTML content into Selenium
#                 driver.get("data:text/html;charset=utf-8," + html_content)
#                 loaded_content = driver.page_source
#                 print("Loaded Content:")
#                 print(loaded_content)
#                 # elements1 = driver.find_elements(By.XPATH, "//*")  # Find all elements
#                 # print(f"Number of elements found: {len(elements1)}")
#                 # for elem in elements1:  # Print the first few elements for verification
#                 #     print(f"Tag: {elem.tag_name}, Text: {elem.text}")
#                 # Wait for content to load (if applicable)
#                 try:
#                     WebDriverWait(driver, 10).until(
#                         EC.presence_of_element_located((By.XPATH, "//*"))
#                     )
#                 except Exception as e:
#                     print(f"Timeout waiting for content: {e}")

#                 # Define relevant tags for user-visible elements
#                 RELEVANT_TAGS = [
#                     "button", "input", "textarea", "select", "label",
#                     "p", "span", "div", "h1", "h2", "h3", "h4", "h5", "h6", "a", "img"
#                 ]

#                 # Find all relevant elements
#                 elements = []
#                 # for tag in RELEVANT_TAGS:
#                 #     print("Hi", driver.find_elements(By.TAG_NAME, tag))
#                 #     elements.extend(driver.find_elements(By.TAG_NAME, tag))
#                 # print("elements", elements)
#                 elements = driver.find_elements(By.XPATH, "//*")
#                 print(f"Number of elements found: {len(elements)}")
#                 # Extract data for visible elements
#                 data = []
#                 for elem in elements:
#                     if is_visible(elem):
#                         try:
#                             data.append({
#                                 "Relative XPath": get_relative_xpath(elem),
#                                 "x": elem.location["x"],
#                                 "y": elem.location["y"],
#                                 "width": elem.size["width"],
#                                 "height": elem.size["height"],
#                                 "background-color": elem.value_of_css_property("background-color"),
#                                 "font-size": elem.value_of_css_property("font-size"),
#                                 "font-style": elem.value_of_css_property("font-style"),
#                                 "font-color": elem.value_of_css_property("color"),
#                                 "text": elem.text.strip(),
#                             })
#                         except Exception as e:
#                             print(f"Error processing element: {e}")

#                 # Save data to a DataFrame
#                 df = pd.DataFrame(data)

#                 # Save to CSV
#                 file_path = f"extracted_elements_{uuid.uuid4().hex}.csv"
#                 df.to_csv(file_path, index=False)
#                 print(f"Data saved to {file_path}")

#                 return Response({"message": "Elements extracted successfully", "rows": len(df)}, status=status.HTTP_200_OK)

#         except Exception as e:
#             return Response({"error": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)